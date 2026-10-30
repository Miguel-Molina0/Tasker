import os
import requests
from datetime import datetime, date
from decimal import Decimal
from functools import wraps

import psycopg
from psycopg.rows import dict_row
from flask import Flask, jsonify, request, session, render_template, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "dev-only-change-this-secret-key")
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax")

DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://tasker:tasker_dev_password@localhost:5432/tasker"
)

def db():
    return psycopg.connect(DATABASE_URL, row_factory=dict_row)

def init_db():
    schema = """
    CREATE TABLE IF NOT EXISTS admins (
        id BIGSERIAL PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(40) NOT NULL DEFAULT 'admin',
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        full_name VARCHAR(160) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(40),
        provider_customer_id VARCHAR(120),
        provider_wallet_id VARCHAR(120),
        user_type VARCHAR(30) NOT NULL CHECK (user_type IN ('Contratante','Autônomo')),
        status VARCHAR(30) NOT NULL DEFAULT 'Ativo' CHECK (status IN ('Ativo','Suspenso','Banido')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS contracts (
        id BIGSERIAL PRIMARY KEY,
        client_id BIGINT REFERENCES users(id),
        worker_id BIGINT REFERENCES users(id),
        service VARCHAR(160) NOT NULL,
        amount_cents BIGINT NOT NULL CHECK (amount_cents >= 0),
        status VARCHAR(30) NOT NULL DEFAULT 'Pendente'
          CHECK (status IN ('Pendente','Ativo','Concluído','Cancelado','Em mediação')),
        scheduled_for DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS payments (
        id BIGSERIAL PRIMARY KEY,
        contract_id BIGINT REFERENCES contracts(id),
        client_id BIGINT REFERENCES users(id),
        worker_id BIGINT REFERENCES users(id),
        provider VARCHAR(80) NOT NULL DEFAULT 'manual',
        provider_payment_id VARCHAR(200),
        provider_transfer_id VARCHAR(200),
        checkout_url TEXT,
        amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
        fee_cents BIGINT NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
        status VARCHAR(30) NOT NULL DEFAULT 'Pendente'
          CHECK (status IN ('Pendente','Pago','Em custódia','Liberado','Estornado','Em mediação','Falhou')),
        currency CHAR(3) NOT NULL DEFAULT 'BRL',
        paid_at TIMESTAMPTZ,
        released_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS audit_logs (
        id BIGSERIAL PRIMARY KEY,
        admin_id BIGINT REFERENCES admins(id),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(60) NOT NULL,
        entity_id VARCHAR(100),
        details JSONB NOT NULL DEFAULT '{}'::jsonb,
        ip_address VARCHAR(80),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_customer_id VARCHAR(120);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_wallet_id VARCHAR(120);
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS provider_transfer_id VARCHAR(200);
    ALTER TABLE payments ADD COLUMN IF NOT EXISTS checkout_url TEXT;
    CREATE TABLE IF NOT EXISTS provider_webhook_events (
        id BIGSERIAL PRIMARY KEY,
        provider VARCHAR(40) NOT NULL,
        event_id VARCHAR(200) NOT NULL,
        event_type VARCHAR(120) NOT NULL,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(provider, event_id)
    );
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
    CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
    """
    with db() as conn:
        conn.execute(schema)
        admin_email = os.environ.get("ADMIN_EMAIL", "admin@tasker.local").lower()
        admin_password = os.environ.get("ADMIN_PASSWORD", "TaskerDemo!2026")
        exists = conn.execute("SELECT id FROM admins WHERE email=%s", (admin_email,)).fetchone()
        if not exists:
            conn.execute(
                "INSERT INTO admins(name,email,password_hash) VALUES (%s,%s,%s)",
                ("Administrador Tasker", admin_email, generate_password_hash(admin_password))
            )
        n = conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]
        if n == 0:
            users = [
                ("Mariana Lima","mariana.lima@example.com","11999990001","Contratante","Ativo"),
                ("João Martins","joao.martins@example.com","11999990002","Autônomo","Ativo"),
                ("Rafael Souza","rafael.souza@example.com","11999990003","Contratante","Ativo"),
                ("Patrícia Silva","patricia.silva@example.com","11999990004","Autônomo","Ativo"),
                ("Camila Rocha","camila.rocha@example.com","11999990005","Contratante","Ativo"),
                ("Lucas Ferreira","lucas.ferreira@example.com","11999990006","Autônomo","Ativo"),
            ]
            for u in users:
                conn.execute("INSERT INTO users(full_name,email,phone,user_type,status) VALUES (%s,%s,%s,%s,%s)", u)
            ids = conn.execute("SELECT id, full_name FROM users").fetchall()
            by_name = {x["full_name"]: x["id"] for x in ids}
            contracts = [
                ("Limpeza residencial","Mariana Lima","João Martins",12000,"Concluído"),
                ("Manutenção geral","Rafael Souza","Patrícia Silva",18000,"Ativo"),
                ("Cabeleireiro","Camila Rocha","Lucas Ferreira",9500,"Pendente"),
                ("Instalação de computador","Mariana Lima","Lucas Ferreira",20000,"Em mediação"),
            ]
            for service, client, worker, amount, status in contracts:
                cur = conn.execute(
                    "INSERT INTO contracts(client_id,worker_id,service,amount_cents,status,scheduled_for) VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
                    (by_name[client], by_name[worker], service, amount, status, date.today())
                ).fetchone()
                fee = amount // 10
                pay_status = {"Concluído":"Pago","Ativo":"Pendente","Pendente":"Pendente","Em mediação":"Em mediação"}[status]
                conn.execute(
                    "INSERT INTO payments(contract_id,client_id,worker_id,amount_cents,fee_cents,status,paid_at) VALUES (%s,%s,%s,%s,%s,%s,CASE WHEN %s='Pago' THEN NOW() ELSE NULL END)",
                    (cur["id"], by_name[client], by_name[worker], amount, fee, pay_status, pay_status)
                )

def login_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("admin_id"):
            return jsonify({"error":"Autenticação necessária."}), 401
        return fn(*args, **kwargs)
    return wrapper

def audit(conn, action, entity_type, entity_id=None, details=None):
    conn.execute(
        "INSERT INTO audit_logs(admin_id,action,entity_type,entity_id,details,ip_address) VALUES (%s,%s,%s,%s,%s,%s)",
        (session.get("admin_id"), action, entity_type, str(entity_id) if entity_id is not None else None,
         psycopg.types.json.Jsonb(details or {}), request.headers.get("X-Forwarded-For", request.remote_addr))
    )

def cents_to_money(cents):
    return f"{(Decimal(cents or 0) / Decimal(100)):.2f}"

def row_payment(row):
    if not row: return None
    return {
        "id": row["id"], "reference": f"TSK-{row['id']:05d}",
        "client": row.get("client_name") or "—", "worker": row.get("worker_name") or "—",
        "service": row.get("service") or "—", "amount_cents": row["amount_cents"],
        "amount": cents_to_money(row["amount_cents"]), "fee_cents": row["fee_cents"],
        "fee": cents_to_money(row["fee_cents"]), "status": row["status"],
        "date": row["created_at"].strftime("%d/%m/%Y") if row.get("created_at") else "",
        "provider": row["provider"], "provider_payment_id": row.get("provider_payment_id"),
        "provider_transfer_id": row.get("provider_transfer_id"), "checkout_url": row.get("checkout_url"),
        "contract_id": row["contract_id"]
    }

PAYMENT_SELECT = """
SELECT p.*, c.service, cu.full_name AS client_name, wu.full_name AS worker_name
FROM payments p
LEFT JOIN contracts c ON c.id=p.contract_id
LEFT JOIN users cu ON cu.id=p.client_id
LEFT JOIN users wu ON wu.id=p.worker_id
"""

@app.get("/")
def index():
    return render_template("index.html")

@app.get("/health")
def health():
    try:
        with db() as conn:
            conn.execute("SELECT 1")
        return jsonify({"status":"ok","database":"connected"})
    except Exception:
        return jsonify({"status":"error","database":"unavailable"}), 503

@app.post("/api/login")
def api_login():
    payload = request.get_json(silent=True) or {}
    email = str(payload.get("email","")).strip().lower()
    password = str(payload.get("password",""))
    with db() as conn:
        admin = conn.execute("SELECT * FROM admins WHERE email=%s AND active=TRUE", (email,)).fetchone()
        if not admin or not check_password_hash(admin["password_hash"], password):
            return jsonify({"error":"E-mail ou senha inválidos."}), 401
        session.clear()
        session["admin_id"] = admin["id"]
        session["admin_name"] = admin["name"]
        session["admin_role"] = admin["role"]
        audit(conn, "login", "admin", admin["id"])
    return jsonify({"id":admin["id"],"name":admin["name"],"email":admin["email"],"role":admin["role"]})

@app.post("/api/logout")
def api_logout():
    if session.get("admin_id"):
        with db() as conn:
            audit(conn, "logout", "admin", session.get("admin_id"))
    session.clear()
    return jsonify({"ok":True})

@app.get("/api/me")
def api_me():
    if not session.get("admin_id"):
        return jsonify({"authenticated":False}), 401
    return jsonify({"authenticated":True,"name":session.get("admin_name"),"role":session.get("admin_role")})

@app.get("/api/dashboard")
@login_required
def dashboard_api():
    with db() as conn:
        p = conn.execute("""
          SELECT COALESCE(SUM(amount_cents) FILTER (WHERE status <> 'Estornado'),0) AS gross,
          COALESCE(SUM(amount_cents) FILTER (WHERE status='Pendente'),0) AS pending,
          COUNT(*) FILTER (WHERE status='Em mediação') AS disputes,
          COUNT(*) FILTER (WHERE status IN ('Pago','Liberado')) AS completed,
          COUNT(*) AS transactions FROM payments
        """).fetchone()
        users = conn.execute("SELECT COUNT(*) FILTER (WHERE status='Ativo') AS active, COUNT(*) AS total FROM users").fetchone()
        recent = conn.execute(PAYMENT_SELECT + " ORDER BY p.created_at DESC LIMIT 8").fetchall()
        return jsonify({
            "gross_cents":p["gross"], "pending_cents":p["pending"], "disputes":p["disputes"],
            "completed":p["completed"], "transactions":p["transactions"], "active_users":users["active"],
            "total_users":users["total"], "recent":[row_payment(r) for r in recent]
        })

@app.get("/api/payments")
@login_required
def list_payments():
    q = "%" + request.args.get("q","").strip() + "%"
    status = request.args.get("status","")
    sql = PAYMENT_SELECT + " WHERE (p.id::text ILIKE %s OR COALESCE(cu.full_name,'') ILIKE %s OR COALESCE(wu.full_name,'') ILIKE %s OR COALESCE(c.service,'') ILIKE %s)"
    args = [q,q,q,q]
    if status and status != "Todos":
        sql += " AND p.status=%s"; args.append(status)
    sql += " ORDER BY p.created_at DESC"
    with db() as conn:
        rows = conn.execute(sql, args).fetchall()
    return jsonify([row_payment(r) for r in rows])

@app.post("/api/payments/<int:payment_id>/action")
@login_required
def payment_action(payment_id):
    payload = request.get_json(silent=True) or {}
    action = payload.get("action")
    if action == "release":
        return release_payment(payment_id)
    if action == "refund":
        return jsonify({"error":"Estorno via API ainda não está habilitado nesta versão. Nenhum dinheiro foi movimentado."}), 501
    allowed = {"hold":("Pendente","Em custódia"), "dispute":("Pendente","Em mediação"), "mark_paid":("Pendente","Pago"), "resolve_dispute":("Em mediação","Em custódia")}
    if action not in allowed:
        return jsonify({"error":"Ação inválida."}), 400
    old, new = allowed[action]
    with db() as conn:
        row = conn.execute("SELECT * FROM payments WHERE id=%s FOR UPDATE", (payment_id,)).fetchone()
        if not row:
            return jsonify({"error":"Pagamento não encontrado."}), 404
        if row["status"] != old:
            return jsonify({"error":f"Ação não permitida para o status atual ({row['status']})."}), 409
        conn.execute("UPDATE payments SET status=%s, updated_at=NOW(), paid_at=CASE WHEN %s='Pago' THEN NOW() ELSE paid_at END WHERE id=%s", (new,new,payment_id))
        audit(conn, f"payment_{action}", "payment", payment_id, {"from":old,"to":new})
    return jsonify({"ok":True,"status":new})

@app.get("/api/users")
@login_required
def list_users():
    q = "%" + request.args.get("q","").strip() + "%"
    kind = request.args.get("type","")
    sql = "SELECT * FROM users WHERE (full_name ILIKE %s OR email ILIKE %s OR id::text ILIKE %s)"
    args = [q,q,q]
    if kind and kind != "Todos":
        sql += " AND user_type=%s"; args.append(kind)
    sql += " ORDER BY created_at DESC"
    with db() as conn:
        rows = conn.execute(sql,args).fetchall()
    return jsonify([{"id":u["id"],"name":u["full_name"],"email":u["email"],"phone":u["phone"],"type":u["user_type"],"status":u["status"],"created_at":u["created_at"].strftime("%d/%m/%Y")} for u in rows])

@app.post("/api/users")
@login_required
def create_user():
    d=request.get_json(silent=True) or {}
    name=str(d.get("name","")).strip(); email=str(d.get("email","")).strip().lower()
    kind=d.get("type","Autônomo"); phone=str(d.get("phone","")).strip()
    if not name or not email or kind not in ("Contratante","Autônomo"):
        return jsonify({"error":"Informe nome, e-mail e um tipo válido."}),400
    try:
        with db() as conn:
            u=conn.execute("INSERT INTO users(full_name,email,phone,user_type) VALUES (%s,%s,%s,%s) RETURNING id",(name,email,phone,kind)).fetchone()
            audit(conn,"user_created","user",u["id"],{"email":email,"type":kind})
        return jsonify({"id":u["id"],"ok":True}),201
    except psycopg.errors.UniqueViolation:
        return jsonify({"error":"Já existe um usuário com esse e-mail."}),409

@app.post("/api/users/<int:user_id>/toggle")
@login_required
def toggle_user(user_id):
    with db() as conn:
        u=conn.execute("SELECT * FROM users WHERE id=%s FOR UPDATE",(user_id,)).fetchone()
        if not u:return jsonify({"error":"Usuário não encontrado."}),404
        new="Suspenso" if u["status"]=="Ativo" else "Ativo"
        conn.execute("UPDATE users SET status=%s WHERE id=%s",(new,user_id))
        audit(conn,"user_status_changed","user",user_id,{"from":u["status"],"to":new})
    return jsonify({"ok":True,"status":new})

@app.get("/api/contracts")
@login_required
def list_contracts():
    with db() as conn:
        rows=conn.execute("""SELECT c.*, cu.full_name AS client_name, wu.full_name AS worker_name
          FROM contracts c LEFT JOIN users cu ON cu.id=c.client_id LEFT JOIN users wu ON wu.id=c.worker_id ORDER BY c.created_at DESC""").fetchall()
    return jsonify([{"id":c["id"],"reference":f"CTR-{c['id']:05d}","client":c["client_name"] or "—","worker":c["worker_name"] or "—","service":c["service"],"amount":cents_to_money(c["amount_cents"]),"status":c["status"],"date":c["created_at"].strftime("%d/%m/%Y")} for c in rows])

@app.post("/api/contracts/<int:contract_id>/complete")
@login_required
def complete_contract(contract_id):
    with db() as conn:
        c=conn.execute("SELECT * FROM contracts WHERE id=%s FOR UPDATE",(contract_id,)).fetchone()
        if not c:return jsonify({"error":"Contrato não encontrado."}),404
        if c["status"] not in ("Ativo","Pendente"):
            return jsonify({"error":"Somente contratos ativos ou pendentes podem ser concluídos."}),409
        conn.execute("UPDATE contracts SET status='Concluído' WHERE id=%s",(contract_id,))
        audit(conn,"contract_marked_completed","contract",contract_id,{"from":c["status"],"to":"Concluído"})
    return jsonify({"ok":True,"status":"Concluído","warning":"Confirme a conclusão com as partes antes de solicitar o repasse."})

@app.get("/api/reports")
@login_required
def reports():
    with db() as conn:
        rows=conn.execute("SELECT status,COUNT(*) AS count,COALESCE(SUM(amount_cents),0) AS amount FROM payments GROUP BY status ORDER BY status").fetchall()
    return jsonify([{"status":r["status"],"count":r["count"],"amount":cents_to_money(r["amount"])} for r in rows])

@app.get("/api/audit")
@login_required
def audit_logs():
    with db() as conn:
        rows=conn.execute("""SELECT a.*, ad.name AS admin_name FROM audit_logs a LEFT JOIN admins ad ON ad.id=a.admin_id ORDER BY a.created_at DESC LIMIT 100""").fetchall()
    return jsonify([{"id":r["id"],"admin":r["admin_name"],"action":r["action"],"entity":r["entity_type"],"entity_id":r["entity_id"],"details":r["details"],"date":r["created_at"].strftime("%d/%m/%Y %H:%M:%S")} for r in rows])

@app.get("/api/export/payments.csv")
@login_required
def export_payments():
    from flask import Response
    import csv, io
    with db() as conn:
        rows=conn.execute(PAYMENT_SELECT + " ORDER BY p.created_at DESC").fetchall()
    out=io.StringIO(); w=csv.writer(out,delimiter=";")
    w.writerow(["Referência","Cliente","Autônomo","Serviço","Valor (centavos)","Taxa (centavos)","Status","Data"])
    for r in rows:
        w.writerow([f"TSK-{r['id']:05d}",r.get("client_name"),r.get("worker_name"),r.get("service"),r["amount_cents"],r["fee_cents"],r["status"],r["created_at"].isoformat()])
    return Response("\ufeff"+out.getvalue(),mimetype="text/csv; charset=utf-8",headers={"Content-Disposition":"attachment; filename=tasker-pagamentos.csv"})

def asaas_config():
    key = os.environ.get("ASAAS_API_KEY", "").strip()
    if not key:
        raise RuntimeError("ASAAS_API_KEY não configurada no arquivo .env.")
    env = os.environ.get("ASAAS_ENV", "sandbox").lower()
    base = "https://api.asaas.com/v3" if env == "production" else "https://api-sandbox.asaas.com/v3"
    return base, key

def asaas_request(method, path, payload=None):
    base, key = asaas_config()
    response = requests.request(
        method, base + path, json=payload,
        headers={"access_token": key, "Content-Type": "application/json", "User-Agent": "TaskerMarketplace/1.0"},
        timeout=25
    )
    try:
        data = response.json()
    except ValueError:
        data = {"message": response.text[:500]}
    if response.status_code >= 400:
        detail = data.get("errors", data.get("message", "Erro retornado pelo Asaas.")) if isinstance(data, dict) else "Erro retornado pelo Asaas."
        raise ValueError(f"Asaas HTTP {response.status_code}: {detail}")
    return data

def release_payment(payment_id):
    """Request transfer only after the contract is marked completed; webhook confirms finality."""
    try:
        with db() as conn:
            p = conn.execute("""SELECT p.*, c.status AS contract_status, u.provider_wallet_id
                FROM payments p LEFT JOIN contracts c ON c.id=p.contract_id
                LEFT JOIN users u ON u.id=p.worker_id WHERE p.id=%s FOR UPDATE OF p""", (payment_id,)).fetchone()
            if not p:
                return jsonify({"error":"Pagamento não encontrado."}), 404
            if p["status"] != "Em custódia":
                return jsonify({"error":"Somente pagamentos recebidos e em custódia podem ser liberados."}), 409
            if p["contract_status"] != "Concluído":
                return jsonify({"error":"O contrato precisa estar marcado como Concluído antes do repasse."}), 409
            if not p["provider_payment_id"] or p["provider"] != "asaas":
                return jsonify({"error":"Este pagamento não foi recebido pelo Asaas."}), 409
            if p["provider_transfer_id"]:
                return jsonify({"error":"Já existe uma solicitação de repasse para este pagamento.", "transfer_id":p["provider_transfer_id"]}), 409
            wallet_id = p["provider_wallet_id"]
            if not wallet_id:
                return jsonify({"error":"Cadastre o walletId da subconta Asaas do autônomo antes do repasse."}), 422
            net_cents = int(p["amount_cents"]) - int(p["fee_cents"])
            if net_cents <= 0:
                return jsonify({"error":"O valor líquido do repasse deve ser positivo."}), 422
            # Reserve a unique marker before network I/O to prevent simultaneous duplicate clicks.
            marker = f"REQUESTING-{payment_id}"
            conn.execute("UPDATE payments SET provider_transfer_id=%s, updated_at=NOW() WHERE id=%s", (marker,payment_id))
        try:
            transfer = asaas_request("POST", "/transfers/", {
                "value": round(net_cents / 100, 2),
                "walletId": wallet_id,
                "externalReference": f"TASKER-PAYMENT-{payment_id}"
            })
        except Exception:
            # Keep the reservation marker: a network timeout may happen after the provider accepted
            # the transfer. Never retry blindly; reconcile with Asaas before clearing it manually.
            app.logger.exception("Transferência Asaas com resultado incerto para payment_id=%s", payment_id)
            raise
        with db() as conn:
            conn.execute("UPDATE payments SET provider_transfer_id=%s, updated_at=NOW() WHERE id=%s AND provider_transfer_id=%s", (transfer.get("id"),payment_id,marker))
            audit(conn,"payment_transfer_requested","payment",payment_id,{"provider_transfer_id":transfer.get("id"),"value_cents":net_cents})
        return jsonify({"ok":True,"status":"Repasse solicitado; aguardando confirmação do Asaas.","transfer_id":transfer.get("id")}),202
    except RuntimeError as e:
        return jsonify({"error":str(e)}),503
    except ValueError as e:
        return jsonify({"error":str(e)}),502
    except requests.RequestException:
        return jsonify({"error":"Não foi possível conectar ao Asaas. Consulte os logs e concilie antes de tentar novamente."}),502

@app.post("/api/payments/<int:payment_id>/asaas-checkout")
@login_required
def create_asaas_checkout(payment_id):
    """Create provider customer if needed, then a charge; this does not mean payment was received."""
    try:
        payload = request.get_json(silent=True) or {}
        billing = str(payload.get("billingType", "PIX")).upper()
        if billing not in ("PIX", "BOLETO", "CREDIT_CARD", "UNDEFINED"):
            return jsonify({"error":"Forma de pagamento inválida."}), 400
        with db() as conn:
            p = conn.execute("""SELECT p.*, c.service, cu.id AS customer_user_id, cu.full_name AS customer_name,
                cu.email AS customer_email, cu.phone AS customer_phone, cu.provider_customer_id
                FROM payments p LEFT JOIN contracts c ON c.id=p.contract_id
                LEFT JOIN users cu ON cu.id=p.client_id WHERE p.id=%s FOR UPDATE OF p""",(payment_id,)).fetchone()
            if not p:return jsonify({"error":"Pagamento não encontrado."}),404
            if p["provider_payment_id"]:return jsonify({"error":"Este pagamento já possui cobrança vinculada."}),409
            customer_id=p["provider_customer_id"]
            customer_data={"name":p["customer_name"],"email":p["customer_email"]}
            if p["customer_phone"]: customer_data["mobilePhone"]=''.join(ch for ch in p["customer_phone"] if ch.isdigit())
        if not customer_id:
            customer=asaas_request("POST","/customers",customer_data)
            customer_id=customer.get("id")
            if not customer_id:raise ValueError("Asaas não retornou o ID do cliente.")
            with db() as conn: conn.execute("UPDATE users SET provider_customer_id=%s WHERE id=%s",(customer_id,p["customer_user_id"]))
        charge=asaas_request("POST","/payments",{
            "customer":customer_id,"billingType":billing,
            "value":round(int(p["amount_cents"])/100,2),
            "dueDate":date.today().isoformat(),
            "description":(p["service"] or f"Serviço Tasker {payment_id}")[:500],
            "externalReference":f"TASKER-PAYMENT-{payment_id}"
        })
        with db() as conn:
            conn.execute("UPDATE payments SET provider='asaas', provider_payment_id=%s, checkout_url=%s, updated_at=NOW() WHERE id=%s",
                         (charge.get("id"),charge.get("invoiceUrl"),payment_id))
            audit(conn,"asaas_checkout_created","payment",payment_id,{"provider_payment_id":charge.get("id"),"billing_type":billing})
        return jsonify({"ok":True,"provider_payment_id":charge.get("id"),"invoice_url":charge.get("invoiceUrl"),"status":charge.get("status"),"message":"Cobrança criada. O pagamento só será confirmado por webhook do provedor."}),201
    except RuntimeError as e:return jsonify({"error":str(e)}),503
    except ValueError as e:return jsonify({"error":str(e)}),502
    except requests.RequestException:return jsonify({"error":"Falha de comunicação com o Asaas."}),502

@app.post("/webhooks/asaas")
def asaas_webhook():
    """Authenticated, idempotent Asaas webhook receiver."""
    expected=os.environ.get("ASAAS_WEBHOOK_TOKEN","")
    received=request.headers.get("asaas-access-token","")
    if not expected or not received or not __import__('hmac').compare_digest(expected,received):
        return jsonify({"error":"Webhook não autenticado."}),401
    data=request.get_json(silent=True) or {}
    event_id=str(data.get("id","")).strip(); event=str(data.get("event","")).strip()
    obj=data.get("payment") or data.get("transfer") or {}
    provider_id=obj.get("id")
    if not event_id or not event or not provider_id:
        return jsonify({"error":"Payload de webhook incompleto."}),400
    try:
        with db() as conn:
            inserted=conn.execute("""INSERT INTO provider_webhook_events(provider,event_id,event_type,payload)
                VALUES ('asaas',%s,%s,%s) ON CONFLICT(provider,event_id) DO NOTHING RETURNING id""",
                (event_id,event,psycopg.types.json.Jsonb(data))).fetchone()
            if not inserted:return jsonify({"ok":True,"duplicate":True})
            if event in ("PAYMENT_RECEIVED","PAYMENT_CONFIRMED","PAYMENT_OVERDUE","PAYMENT_REFUNDED","PAYMENT_DELETED","PAYMENT_CHARGEBACK_REQUESTED"):
                p=conn.execute("SELECT * FROM payments WHERE provider='asaas' AND provider_payment_id=%s FOR UPDATE",(provider_id,)).fetchone()
                if p:
                    if event=="PAYMENT_RECEIVED":
                        conn.execute("UPDATE payments SET status='Em custódia', paid_at=COALESCE(paid_at,NOW()), updated_at=NOW() WHERE id=%s AND status IN ('Pendente','Pago')",(p["id"],))
                    elif event in ("PAYMENT_REFUNDED","PAYMENT_CHARGEBACK_REQUESTED"):
                        conn.execute("UPDATE payments SET status=CASE WHEN %s='PAYMENT_REFUNDED' THEN 'Estornado' ELSE 'Em mediação' END, updated_at=NOW() WHERE id=%s",(event,p["id"]))
                    elif event=="PAYMENT_OVERDUE":
                        conn.execute("UPDATE payments SET status='Falhou', updated_at=NOW() WHERE id=%s AND status='Pendente'",(p["id"],))
                    audit(conn,"asaas_webhook_"+event.lower(),"payment",p["id"],{"event_id":event_id,"provider_payment_id":provider_id})
            elif event.startswith("TRANSFER_"):
                p=conn.execute("SELECT * FROM payments WHERE provider='asaas' AND provider_transfer_id=%s FOR UPDATE",(provider_id,)).fetchone()
                if p:
                    if event=="TRANSFER_DONE":
                        conn.execute("UPDATE payments SET status='Liberado', released_at=NOW(), updated_at=NOW() WHERE id=%s",(p["id"],))
                    elif event in ("TRANSFER_FAILED","TRANSFER_CANCELLED","TRANSFER_BLOCKED"):
                        conn.execute("UPDATE payments SET provider_transfer_id=NULL, updated_at=NOW() WHERE id=%s",(p["id"],))
                    audit(conn,"asaas_webhook_"+event.lower(),"payment",p["id"],{"event_id":event_id,"provider_transfer_id":provider_id})
        return jsonify({"ok":True})
    except Exception:
        app.logger.exception("Falha processando webhook Asaas")
        return jsonify({"error":"Falha interna ao processar webhook; o provedor poderá reenviar."}),500

@app.post("/api/users/<int:user_id>/asaas-wallet")
@login_required
def set_asaas_wallet(user_id):
    payload=request.get_json(silent=True) or {}
    wallet_id=str(payload.get("walletId","")).strip()
    if not wallet_id or len(wallet_id)>120:return jsonify({"error":"Informe um walletId válido."}),400
    with db() as conn:
        u=conn.execute("SELECT id,user_type FROM users WHERE id=%s",(user_id,)).fetchone()
        if not u:return jsonify({"error":"Usuário não encontrado."}),404
        if u["user_type"]!="Autônomo":return jsonify({"error":"A carteira de repasse deve pertencer a um autônomo."}),400
        conn.execute("UPDATE users SET provider_wallet_id=%s WHERE id=%s",(wallet_id,user_id))
        audit(conn,"asaas_wallet_updated","user",user_id,{"wallet_id_suffix":wallet_id[-6:]})
    return jsonify({"ok":True})

@app.get("/api/settings")
@login_required
def get_settings():
    configured=bool(os.environ.get("ASAAS_API_KEY") and os.environ.get("ASAAS_WEBHOOK_TOKEN"))
    return jsonify({"provider":"Asaas","provider_configured":configured,"environment":os.environ.get("ASAAS_ENV","sandbox"),"database":"PostgreSQL","mode":"sandbox" if os.environ.get("ASAAS_ENV","sandbox")!="production" else "production","note":"Repasse depende de contrato habilitado, subconta vinculada e confirmação por webhook."})

with app.app_context():
    # Retry is handled by Docker healthcheck/startup ordering; fail loudly if DB unavailable.
    init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT","8000")), debug=False)
