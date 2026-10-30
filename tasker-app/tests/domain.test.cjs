const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const ts = require("typescript");
const source = ts.transpileModule(
  fs.readFileSync(require.resolve("../src/domain.ts"), "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  },
).outputText;
const loaded = new Module("domain");
loaded._compile(source, "domain.js");
const { seed, reduce, dayAfter, conflict, wallet } = loaded.exports;
function futureWeekday(n = 2) {
  let date;
  do {
    date = dayAfter(n++);
  } while ([0, 6].includes(new Date(date + "T12:00:00").getDay()));
  return date;
}
function fixture() {
  let s = reduce(seed(), { type: "login", id: "cliente" });
  const c = {
    id: "novo",
    client: "cliente",
    provider: "pedro",
    ad: "design",
    title: "Teste",
    description: "Cinco telas para app",
    address: "Remoto",
    date: futureWeekday(),
    time: "09:00",
    duration: 60,
    price: 0,
    status: "pendente",
    payment: "nao_pago",
  };
  s = reduce(s, { type: "request", contract: c });
  return s;
}
const login = (s, id) => reduce(s, { type: "login", id });
const transition = (s, event, extra = {}) =>
  reduce(s, { type: "transition", id: "novo", event, ...extra });
const contract = (s) => s.contracts.find((c) => c.id === "novo");
test("jornada completa preserva as duas agendas, custódia, liberação e avaliação", () => {
  let s = fixture();
  assert.equal(contract(s).price, 280);
  assert.equal(contract(s).status, "pendente");
  assert.equal(s.notices.filter((n) => n.target === "novo").length, 2);
  assert.throws(() => transition(s, "accept"));
  s = transition(login(s, "pedro"), "accept");
  assert.equal(contract(s).status, "aceita");
  s = transition(login(s, "cliente"), "pay", { method: "Pix" });
  assert.equal(wallet(s, "pedro").held, 280);
  assert.throws(() => transition(s, "pay"));
  assert.throws(() => transition(s, "finish"));
  s = transition(login(s, "pedro"), "finish");
  s = transition(login(s, "cliente"), "confirm");
  assert.equal(wallet(s, "pedro").held, 0);
  assert.equal(wallet(s, "pedro").available, 480);
  assert.throws(() => transition(s, "confirm"));
  s = reduce(s, {
    type: "review",
    review: {
      id: "r",
      contract: "novo",
      from: "cliente",
      to: "pedro",
      stars: 5,
      text: "Ótimo",
    },
  });
  assert.throws(() =>
    reduce(s, {
      type: "review",
      review: {
        id: "r2",
        contract: "novo",
        from: "cliente",
        to: "pedro",
        stars: 5,
        text: "Repetida",
      },
    }),
  );
});
test("conflitos verificam ambas as pessoas, duração e limites adjacentes", () => {
  const s = fixture(),
    c = contract(s);
  assert.equal(conflict(s, ["pedro"], c.date, "09:30", 60), true);
  assert.equal(conflict(s, ["cliente"], c.date, "08:30", 60), true);
  assert.equal(conflict(s, ["cliente"], c.date, "10:00", 60), false);
  assert.throws(() =>
    reduce(s, {
      type: "request",
      contract: { ...c, id: "duplicado", time: "09:30" },
    }),
  );
  assert.throws(() =>
    reduce(s, {
      type: "request",
      contract: { ...c, id: "invalido", date: "2026-02-30" },
    }),
  );
  assert.throws(() =>
    reduce(s, {
      type: "request",
      contract: { ...c, id: "duracao", time: "23:30", duration: 90 },
    }),
  );
});
test("pagamento cancelado é reembolsado e horário liberado", () => {
  let s = fixture();
  s = transition(login(s, "pedro"), "accept");
  s = transition(login(s, "cliente"), "pay");
  const c = contract(s);
  s = transition(s, "cancel", { reason: "Mudança de planos" });
  assert.equal(contract(s).payment, "reembolsado");
  assert.equal(conflict(s, ["cliente", "pedro"], c.date, c.time, 60), false);
  assert.equal(wallet(s, "pedro").held, 0);
  assert.equal(wallet(s, "pedro").available, 200);
});
test("reagendamento requer outra pessoa e revalida conflitos ao aceitar", () => {
  let s = fixture(),
    c = contract(s);
  s = reduce(s, { type: "reschedule", id: c.id, date: c.date, time: "14:00" });
  assert.equal(contract(s).time, "09:00");
  assert.throws(() =>
    reduce(s, { type: "answerChange", id: c.id, accept: true }),
  );
  s = login(s, "pedro");
  s = reduce(s, {
    type: "event",
    event: {
      id: "e",
      user: "pedro",
      title: "Reunião",
      date: c.date,
      time: "14:00",
      duration: 60,
      note: "",
    },
  });
  assert.throws(() =>
    reduce(s, { type: "answerChange", id: c.id, accept: true }),
  );
  s = reduce(s, { type: "deleteEvent", id: "e" });
  s = reduce(s, { type: "answerChange", id: c.id, accept: true });
  assert.equal(contract(s).time, "14:00");
  assert.equal(contract(s).change, undefined);
});
test("contestação bloqueia pagamento e cria protocolo", () => {
  let s = fixture();
  s = transition(login(s, "pedro"), "accept");
  s = transition(login(s, "cliente"), "pay");
  s = transition(login(s, "pedro"), "finish");
  s = transition(login(s, "cliente"), "dispute", {
    reason: "Escopo incompleto",
  });
  assert.equal(contract(s).payment, "bloqueado");
  assert.equal(contract(s).status, "contestada");
  assert.equal(s.tickets.length, 1);
  assert.throws(() => transition(s, "confirm"));
});
test("mensagens, bloqueio bilateral e exclusão respeitam autor", () => {
  let s = login(seed(), "cliente");
  s = reduce(s, { type: "message", to: "pedro", text: "Olá" });
  const m = s.messages.at(-1);
  s = login(s, "pedro");
  s = reduce(s, { type: "deleteMessage", id: m.id });
  assert.equal(
    s.messages.some((x) => x.id === m.id),
    true,
  );
  s = reduce(s, { type: "readMessages", from: "cliente" });
  assert.equal(s.messages.at(-1).read, true);
  s = reduce(s, { type: "block", id: "cliente" });
  assert.throws(() =>
    reduce(s, { type: "message", to: "cliente", text: "Oi" }),
  );
  s = login(s, "cliente");
  assert.throws(() => reduce(s, { type: "message", to: "pedro", text: "Oi" }));
  s = reduce(s, { type: "deleteMessage", id: m.id });
  assert.equal(
    s.messages.some((x) => x.id === m.id),
    false,
  );
});
test("saque não permite ultrapassar saldo nem repetir uso do mesmo saldo", () => {
  let s = login(seed(), "pedro");
  assert.throws(() => reduce(s, { type: "withdraw", value: 201 }));
  s = reduce(s, { type: "withdraw", value: 200 });
  assert.equal(wallet(s, "pedro").available, 0);
  assert.throws(() => reduce(s, { type: "withdraw", value: 1 }));
});
test("favoritos por conta, rascunhos e controle de propriedade", () => {
  let s = login(seed(), "cliente");
  s = reduce(s, { type: "favorite", id: "design" });
  assert.deepEqual(s.favorites.cliente, ["design"]);
  assert.throws(() => reduce(s, { type: "deleteAd", id: "design" }));
  s = login(s, "pedro");
  assert.equal(s.favorites.pedro, undefined);
  s = reduce(s, {
    type: "ad",
    ad: {
      ...s.ads[0],
      id: "draft",
      title: "Rascunho",
      published: false,
      price: 0,
    },
  });
  s = login(s, "cliente");
  assert.throws(() => reduce(s, { type: "favorite", id: "draft" }));
});
test("exclusão de conta ativa impedida; tema preserva dados", () => {
  let s = fixture();
  assert.throws(() => reduce(s, { type: "deleteAccount" }));
  s = reduce(s, { type: "theme", theme: "light" });
  assert.equal(contract(s).status, "pendente");
});
