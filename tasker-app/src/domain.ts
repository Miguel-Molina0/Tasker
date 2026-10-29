/** Tipos e validadores da interface. Persistência e autenticação são implementadas em api-client.ts, remote.ts e store.tsx. seed/reduce são regras legadas mantidas como referência e não alimentam o app integrado. */
export type Role = "cliente" | "profissional";
export type Status =
  | "pendente"
  | "aceita"
  | "em_andamento"
  | "aguardando_confirmacao"
  | "concluida"
  | "cancelada"
  | "recusada"
  | "contestada";
export type Payment =
  | "processando"
  | "nao_pago"
  | "retido"
  | "liberado"
  | "reembolsado"
  | "bloqueado";
export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  bio: string;
  city: string;
  phone: string;
  avatar?: string;
  passwordHash?: string;
  username?: string;
};
export type Ad = {
  id: string;
  provider: string;
  title: string;
  description: string;
  category: string;
  price: number;
  city: string;
  published: boolean;
  images: string[];
  days: number[];
};
export type Contract = {
  id: string;
  client: string;
  provider: string;
  ad: string;
  title: string;
  description: string;
  address: string;
  date: string;
  time: string;
  duration: number;
  price: number;
  status: Status;
  payment: Payment;
  method?: string;
  confirmedClient?: boolean;
  confirmedProvider?: boolean;
  paymentId?: string;
  pixCode?: string;
  pixImage?: string;
  reason?: string;
  change?: { date: string; time: string; by: string };
};
export type Event = {
  id: string;
  user: string;
  title: string;
  date: string;
  time: string;
  duration: number;
  note: string;
};
export type Review = {
  id: string;
  contract: string;
  from: string;
  to: string;
  stars: number;
  text: string;
};
export type Message = {
  id: string;
  from: string;
  to: string;
  text: string;
  created: string;
  read: boolean;
};
export type Notice = {
  id: string;
  user: string;
  text: string;
  route: string;
  target?: string;
  read: boolean;
};
export type Ticket = {
  id: string;
  user: string;
  subject: string;
  text: string;
  target?: string;
  created: string;
  status?: string;
  response?: string;
};
export type State = {
  calendar?: {id:string;contract:string;date:string;time:string;status:string}[];
  version: 1;
  current: string | null;
  theme: "dark" | "light";
  users: User[];
  ads: Ad[];
  contracts: Contract[];
  events: Event[];
  reviews: Review[];
  messages: Message[];
  notices: Notice[];
  tickets: Ticket[];
  favorites: Record<string, string[]>;
  blocked: Record<string, string[]>;
  withdrawals: { id: string; user: string; value: number; created: string }[];
};
export const categories = [
  "Todos",
  "Design",
  "Elétrica",
  "Limpeza",
  "Beleza",
  "Reformas",
  "Tecnologia",
];
export const statusLabel: Record<Status, string> = {
  pendente: "Aguardando aceite",
  aceita: "Aguardando pagamento",
  em_andamento: "Agendado",
  aguardando_confirmacao: "Confirmar entrega",
  concluida: "Concluído",
  cancelada: "Cancelado",
  recusada: "Recusado",
  contestada: "Em contestação",
};
export const paymentLabel: Record<Payment, string> = {
  processando: "Repasse em processamento",
  nao_pago: "Aguardando pagamento",
  retido: "Recebido · aguardando conclusão",
  liberado: "Liberado",
  reembolsado: "Reembolsado",
  bloqueado: "Bloqueado para análise",
};
export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function dayAfter(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localDate(d);
}
export function displayDate(date: string) {
  return date.split("-").reverse().join("/");
}
export const money = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function parseDate(value: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : value;
}
export function validDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const d = new Date(date + "T12:00:00");
  return !isNaN(+d) && localDate(d) === date;
}
export function validTime(time: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}
export function minutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}
export function validateSchedule(date: string, time: string, duration: number) {
  if (!validDate(date) || !validTime(time))
    throw new Error("Informe uma data válida (DD/MM/AAAA) e horário (HH:MM).");
  if (new Date(`${date}T${time}:00`).getTime() <= Date.now())
    throw new Error("Escolha uma data e horário futuros.");
  if (
    !Number.isFinite(duration) ||
    duration < 30 ||
    duration > 480 ||
    minutes(time) + duration > 1440
  )
    throw new Error(
      "A duração deve ser de 30 a 480 minutos, terminando no mesmo dia.",
    );
}
export const isActive = (c: Contract) =>
  !["cancelada", "recusada", "concluida"].includes(c.status);
export function conflict(
  s: State,
  users: string[],
  date: string,
  time: string,
  duration: number,
  except?: string,
) {
  const overlaps = (t: string, d: number) =>
    minutes(time) < minutes(t) + d && minutes(t) < minutes(time) + duration;
  return (
    s.contracts.some(
      (c) =>
        c.id !== except &&
        isActive(c) &&
        c.date === date &&
        (users.includes(c.client) || users.includes(c.provider)) &&
        overlaps(c.time, c.duration),
    ) ||
    s.events.some(
      (e) =>
        e.id !== except &&
        users.includes(e.user) &&
        e.date === date &&
        overlaps(e.time, e.duration),
    )
  );
}
export function available(s: State, ad: Ad, date: string) {
  return (
    validDate(date) &&
    date >= localDate() &&
    ad.days.includes(new Date(date + "T12:00:00").getDay()) &&
    [8, 10, 13, 15, 17].some((h) => {
      const time = `${h}:00`.padStart(5, "0");
      return (
        new Date(`${date}T${time}:00`).getTime() > Date.now() &&
        !conflict(s, [ad.provider], date, time, 60)
      );
    })
  );
}
export function wallet(s: State, user: string) {
  const contracts = s.contracts.filter((c) => c.provider === user);
  const released = contracts
    .filter((c) => c.payment === "liberado")
    .reduce((n, c) => n + c.price, 0);
  return {
    available:
      released -
      s.withdrawals
        .filter((w) => w.user === user)
        .reduce((n, w) => n + w.value, 0),
    held: contracts
      .filter((c) => ["retido", "bloqueado"].includes(c.payment))
      .reduce((n, c) => n + c.price, 0),
    released,
  };
}
export function rating(s: State, user: string) {
  const r = s.reviews.filter((r) => r.to === user);
  return r.length
    ? (r.reduce((n, r) => n + r.stars, 0) / r.length).toFixed(1)
    : "Novo";
}
export function seed(): State {
  return {
    version: 1,
    current: null,
    theme: "dark",
    users: [
      {
        id: "cliente",
        name: "Ana Paula",
        email: "cliente@teste.com",
        role: "cliente",
        city: "Mongaguá",
        phone: "(13) 99999-0001",
        bio: "Buscando profissionais para cuidar dos meus projetos.",
      },
      {
        id: "pedro",
        name: "Pedro Carvalho",
        email: "prestador@teste.com",
        role: "profissional",
        city: "Mongaguá",
        phone: "(13) 99999-0002",
        bio: "Transformo ideias em interfaces. Trabalho com identidade visual, prototipação e design de aplicativos.",
      },
      {
        id: "joao",
        name: "João Santos",
        email: "joao@teste.com",
        role: "profissional",
        city: "Praia Grande",
        phone: "(13) 99999-0003",
        bio: "Instalações e reparos elétricos residenciais. Atendimento cuidadoso e organizado.",
      },
      {
        id: "marina",
        name: "Marina Oliveira",
        email: "marina@teste.com",
        role: "profissional",
        city: "Mongaguá",
        phone: "(13) 99999-0004",
        bio: "Limpeza e organização para deixar sua casa mais leve.",
      },
      {
        id: "bia",
        name: "Beatriz Lima",
        email: "bia@teste.com",
        role: "profissional",
        city: "Itanhaém",
        phone: "(13) 99999-0005",
        bio: "Cuidados com seu cabelo e sua autoestima. Atendimento com hora marcada.",
      },
    ],
    ads: [
      {
        id: "design",
        provider: "pedro",
        title: "Sua ideia, um aplicativo de verdade",
        description:
          "Prototipação de até 5 telas no Figma. Inclui conversa inicial, pesquisa de referências e uma rodada de ajustes.",
        category: "Design",
        price: 280,
        city: "Mongaguá",
        published: true,
        images: [],
        days: [1, 2, 3, 4, 5, 6],
      },
      {
        id: "eletrica",
        provider: "joao",
        title: "Reparos elétricos com cuidado",
        description:
          "Visita para diagnóstico e troca de até duas tomadas. Materiais combinados à parte antes da contratação.",
        category: "Elétrica",
        price: 150,
        city: "Praia Grande",
        published: true,
        images: [],
        days: [1, 2, 3, 4, 5, 6],
      },
      {
        id: "limpeza",
        provider: "marina",
        title: "Uma casa limpa, mais tempo para você",
        description:
          "Limpeza residencial de até 4 horas. Combine os cômodos e produtos necessários pelo chat.",
        category: "Limpeza",
        price: 180,
        city: "Mongaguá",
        published: true,
        images: [],
        days: [1, 2, 3, 4, 5],
      },
      {
        id: "beleza",
        provider: "bia",
        title: "Um novo cuidado para o seu cabelo",
        description:
          "Corte e finalização com atendimento individual no espaço da profissional.",
        category: "Beleza",
        price: 90,
        city: "Itanhaém",
        published: true,
        images: [],
        days: [2, 3, 4, 5, 6],
      },
    ],
    contracts: [
      {
        id: "historico",
        client: "cliente",
        provider: "pedro",
        ad: "design",
        title: "Identidade visual para um projeto",
        description: "Criação de apresentação visual.",
        address: "Atendimento remoto",
        date: dayAfter(-7),
        time: "10:00",
        duration: 60,
        price: 200,
        status: "concluida",
        payment: "liberado",
        method: "Pix demonstrativo",
      },
    ],
    events: [],
    reviews: [
      {
        id: "review-inicial",
        contract: "historico",
        from: "cliente",
        to: "pedro",
        stars: 5,
        text: "Gostei muito do cuidado com os detalhes e do atendimento!",
      },
    ],
    messages: [
      {
        id: "mensagem-inicial",
        from: "pedro",
        to: "cliente",
        text: "Olá, Ana! Pode me contar sua ideia por aqui. Vamos combinar o escopo antes de agendar.",
        created: new Date().toISOString(),
        read: false,
      },
    ],
    notices: [],
    tickets: [],
    favorites: {},
    blocked: {},
    withdrawals: [],
  };
}
export type Action =
  | { type: "login"; id: string }
  | { type: "logout" }
  | { type: "theme"; theme: State["theme"] }
  | { type: "register"; user: User }
  | { type: "profile"; patch: Partial<User> }
  | { type: "deleteAccount" }
  | { type: "favorite"; id: string }
  | { type: "block"; id: string }
  | { type: "ad"; ad: Ad }
  | { type: "deleteAd"; id: string }
  | { type: "request"; contract: Contract }
  | {
      type: "transition";
      id: string;
      event:
        | "accept"
        | "decline"
        | "pay"
        | "finish"
        | "confirm"
        | "cancel"
        | "dispute";
      reason?: string;
      method?: string;
    }
  | { type: "reschedule"; id: string; date: string; time: string }
  | { type: "answerChange"; id: string; accept: boolean }
  | { type: "event"; event: Event }
  | { type: "deleteEvent"; id: string }
  | { type: "review"; review: Review }
  | { type: "message"; to: string; text: string }
  | { type: "deleteMessage"; id: string }
  | { type: "readMessages"; from: string }
  | { type: "readNotice"; id?: string }
  | { type: "ticket"; ticket: Ticket }
  | { type: "withdraw"; value: number };
export function reduce(state: State, action: Action): State {
  const s: State = JSON.parse(JSON.stringify(state));
  const notify = (user: string, text: string, route: string, target?: string) =>
    s.notices.unshift({ id: uid(), user, text, route, target, read: false });
  if (action.type === "login") {
    if (!s.users.some((u) => u.id === action.id))
      throw new Error("Conta não encontrada.");
    s.current = action.id;
    return s;
  }
  if (action.type === "logout") {
    s.current = null;
    return s;
  }
  if (action.type === "theme") {
    s.theme = action.theme;
    return s;
  }
  if (action.type === "register") {
    if (
      s.users.some(
        (u) => u.email.toLowerCase() === action.user.email.toLowerCase(),
      )
    )
      throw new Error("Este email já possui cadastro.");
    s.users.push(action.user);
    s.current = action.user.id;
    return s;
  }
  const user = s.users.find((u) => u.id === s.current);
  if (!user) throw new Error("Entre na sua conta para continuar.");
  const me = user.id;
  const getContract = (id: string) => {
    const c = s.contracts.find((c) => c.id === id);
    if (!c || ![c.client, c.provider].includes(me))
      throw new Error("Serviço não encontrado.");
    return c;
  };
  const blocked = (other: string) =>
    s.blocked[me]?.includes(other) || s.blocked[other]?.includes(me);
  switch (action.type) {
    case "profile": {
      const { name, bio, city, phone, avatar, passwordHash } = action.patch;
      Object.assign(
        user,
        Object.fromEntries(
          Object.entries({
            name,
            bio,
            city,
            phone,
            avatar,
            passwordHash,
          }).filter(([, v]) => v !== undefined),
        ),
      );
      break;
    }
    case "deleteAccount": {
      if (
        s.contracts.some(
          (c) => [c.client, c.provider].includes(me) && isActive(c),
        )
      )
        throw new Error(
          "Finalize ou cancele os serviços ativos antes de excluir o perfil.",
        );
      if (wallet(s, me).available > 0)
        throw new Error(
          "Simule o saque do saldo disponível antes de excluir o perfil.",
        );
      s.users = s.users.filter((u) => u.id !== me);
      s.ads = s.ads.filter((a) => a.provider !== me);
      s.events = s.events.filter((e) => e.user !== me);
      s.messages = s.messages.filter((m) => m.from !== me && m.to !== me);
      s.notices = s.notices.filter((n) => n.user !== me);
      s.tickets = s.tickets.filter((t) => t.user !== me);
      s.contracts = s.contracts.map((c) => ({
        ...c,
        client: c.client === me ? "excluido" : c.client,
        provider: c.provider === me ? "excluido" : c.provider,
        address: [c.client, c.provider].includes(me)
          ? "Dados removidos"
          : c.address,
      }));
      s.reviews = s.reviews.filter((r) => r.from !== me && r.to !== me);
      delete s.favorites[me];
      delete s.blocked[me];
      s.withdrawals = s.withdrawals.filter((w) => w.user !== me);
      s.current = null;
      break;
    }
    case "favorite": {
      if (!s.ads.some((a) => a.id === action.id && a.published))
        throw new Error("Anúncio indisponível.");
      const list = s.favorites[me] || [];
      s.favorites[me] = list.includes(action.id)
        ? list.filter((id) => id !== action.id)
        : [...list, action.id];
      break;
    }
    case "block": {
      if (action.id === me || !s.users.some((u) => u.id === action.id))
        throw new Error("Perfil inválido.");
      const list = s.blocked[me] || [];
      s.blocked[me] = list.includes(action.id)
        ? list.filter((id) => id !== action.id)
        : [...list, action.id];
      break;
    }
    case "ad": {
      const a = action.ad,
        old = s.ads.find((x) => x.id === a.id);
      if (
        user.role !== "profissional" ||
        a.provider !== me ||
        (old && old.provider !== me)
      )
        throw new Error("Apenas o responsável pode editar este anúncio.");
      if (
        !a.title.trim() ||
        (a.published &&
          (!a.description.trim() ||
            !a.city.trim() ||
            !a.days.length ||
            !Number.isFinite(a.price) ||
            a.price <= 0))
      )
        throw new Error(
          "Preencha título, descrição, cidade, preço e dias de atendimento.",
        );
      if (a.published && a.price < 0.01)
        throw new Error("O preço mínimo é R$ 0,01.");
      s.ads = [
        {
          ...a,
          price: Number.isFinite(a.price) ? Math.round(a.price * 100) / 100 : 0,
        },
        ...s.ads.filter((x) => x.id !== a.id),
      ];
      break;
    }
    case "deleteAd": {
      if (!s.ads.some((a) => a.id === action.id && a.provider === me))
        throw new Error("Anúncio não encontrado.");
      s.ads = s.ads.filter((a) => a.id !== action.id);
      break;
    }
    case "request": {
      const c = action.contract,
        ad = s.ads.find((a) => a.id === c.ad && a.published);
      if (
        user.role !== "cliente" ||
        !ad ||
        ad.provider === me ||
        blocked(ad.provider)
      )
        throw new Error(
          "Não é possível solicitar este serviço com esta conta.",
        );
      validateSchedule(c.date, c.time, c.duration);
      if (!ad.days.includes(new Date(c.date + "T12:00:00").getDay()))
        throw new Error("O profissional não atende nesse dia da semana.");
      if (conflict(s, [me, ad.provider], c.date, c.time, c.duration))
        throw new Error(
          "Esse horário conflita com um compromisso de uma das agendas. Escolha outro horário.",
        );
      if (!c.description.trim() || !c.address.trim())
        throw new Error(
          "Informe o escopo e o endereço ou link do atendimento.",
        );
      if (s.contracts.some((x) => x.id === c.id))
        throw new Error("Solicitação já enviada.");
      s.contracts.unshift({
        ...c,
        client: me,
        provider: ad.provider,
        price: ad.price,
        title: ad.title,
        status: "pendente",
        payment: "nao_pago",
      });
      notify(
        ad.provider,
        "Nova solicitação: " + ad.title,
        "detalhe-contratacao",
        c.id,
      );
      notify(
        me,
        "Solicitação enviada. Compromisso pendente nas duas agendas.",
        "detalhe-contratacao",
        c.id,
      );
      break;
    }
    case "transition": {
      const c = getContract(action.id),
        provider = c.provider === me;
      const fail = () => {
        throw new Error(
          "Esta ação não está disponível para este perfil ou etapa.",
        );
      };
      switch (action.event) {
        case "accept":
          if (!provider || c.status !== "pendente") fail();
          validateSchedule(c.date, c.time, c.duration);
          if (
            conflict(
              s,
              [c.client, c.provider],
              c.date,
              c.time,
              c.duration,
              c.id,
            )
          )
            throw new Error("Há um conflito na agenda.");
          c.status = "aceita";
          break;
        case "decline":
          if (!provider || c.status !== "pendente") fail();
          c.status = "recusada";
          break;
        case "pay":
          if (provider || c.status !== "aceita" || c.payment !== "nao_pago")
            fail();
          c.status = "em_andamento";
          c.payment = "retido";
          c.method = action.method || "Pix demonstrativo";
          break;
        case "finish":
          if (!provider || c.status !== "em_andamento") fail();
          c.status = "aguardando_confirmacao";
          break;
        case "confirm":
          if (provider || c.status !== "aguardando_confirmacao") fail();
          c.status = "concluida";
          c.payment = "liberado";
          break;
        case "cancel":
          if (!["pendente", "aceita", "em_andamento"].includes(c.status))
            fail();
          if (!action.reason?.trim())
            throw new Error("Informe o motivo do cancelamento.");
          c.status = "cancelada";
          if (c.payment === "retido") c.payment = "reembolsado";
          c.reason = action.reason;
          break;
        case "dispute":
          if (provider || c.status !== "aguardando_confirmacao") fail();
          if (!action.reason?.trim())
            throw new Error(
              "Descreva o problema para registrar a contestação.",
            );
          c.status = "contestada";
          c.payment = "bloqueado";
          c.reason = action.reason;
          s.tickets.unshift({
            id: uid(),
            user: me,
            subject: "Contestação de serviço",
            text: action.reason!,
            target: c.id,
            created: new Date().toISOString(),
          });
          break;
      }
      if (!["pendente", "aceita", "em_andamento"].includes(c.status))
        delete c.change;
      [c.client, c.provider].forEach((id) =>
        notify(
          id,
          `${c.title}: ${statusLabel[c.status]}.`,
          "detalhe-contratacao",
          c.id,
        ),
      );
      break;
    }
    case "reschedule": {
      const c = getContract(action.id);
      if (
        !["pendente", "aceita", "em_andamento"].includes(c.status) ||
        c.change
      )
        throw new Error(
          "Aguarde a resposta da alteração atual ou confira a etapa do serviço.",
        );
      validateSchedule(action.date, action.time, c.duration);
      const ad = s.ads.find((a) => a.id === c.ad);
      if (ad && !ad.days.includes(new Date(action.date + "T12:00:00").getDay()))
        throw new Error("O profissional não atende nesse dia.");
      if (
        conflict(
          s,
          [c.client, c.provider],
          action.date,
          action.time,
          c.duration,
          c.id,
        )
      )
        throw new Error("O novo horário conflita com uma das agendas.");
      c.change = { date: action.date, time: action.time, by: me };
      notify(
        c.client === me ? c.provider : c.client,
        "Proposta de novo horário para " + c.title,
        "detalhe-contratacao",
        c.id,
      );
      break;
    }
    case "answerChange": {
      const c = getContract(action.id);
      if (!c.change || c.change.by === me)
        throw new Error("A alteração deve ser respondida pela outra pessoa.");
      if (action.accept) {
        validateSchedule(c.change.date, c.change.time, c.duration);
        if (
          conflict(
            s,
            [c.client, c.provider],
            c.change.date,
            c.change.time,
            c.duration,
            c.id,
          )
        )
          throw new Error(
            "O horário ficou indisponível. Recuse e combine outro.",
          );
        c.date = c.change.date;
        c.time = c.change.time;
      }
      notify(
        c.change.by,
        action.accept
          ? "Novo horário confirmado nas duas agendas."
          : "Alteração recusada. O horário anterior foi mantido.",
        "detalhe-contratacao",
        c.id,
      );
      delete c.change;
      break;
    }
    case "event": {
      const e = action.event,
        old = s.events.find((x) => x.id === e.id);
      if (e.user !== me || (old && old.user !== me))
        throw new Error("Compromisso inválido.");
      validateSchedule(e.date, e.time, e.duration);
      if (!e.title.trim()) throw new Error("Informe um título.");
      if (conflict(s, [me], e.date, e.time, e.duration, e.id))
        throw new Error("Já existe um compromisso nesse horário.");
      s.events = [e, ...s.events.filter((x) => x.id !== e.id)];
      break;
    }
    case "deleteEvent":
      s.events = s.events.filter((e) => !(e.id === action.id && e.user === me));
      break;
    case "review": {
      const r = action.review,
        c = getContract(r.contract);
      if (
        c.status !== "concluida" ||
        s.reviews.some((x) => x.contract === c.id && x.from === me)
      )
        throw new Error("Você pode avaliar uma única vez após a conclusão.");
      if (
        !Number.isInteger(r.stars) ||
        r.stars < 1 ||
        r.stars > 5 ||
        !r.text.trim()
      )
        throw new Error("Escolha de 1 a 5 estrelas e escreva seu comentário.");
      const to = c.client === me ? c.provider : c.client;
      s.reviews.unshift({ ...r, from: me, to });
      notify(to, "Você recebeu uma avaliação.", "perfil-profissional", to);
      break;
    }
    case "message": {
      if (
        !s.users.some((u) => u.id === action.to) ||
        action.to === me ||
        blocked(action.to)
      )
        throw new Error("Conversa indisponível enquanto houver bloqueio.");
      if (!action.text.trim() || action.text.length > 2000)
        throw new Error("Escreva uma mensagem de até 2.000 caracteres.");
      s.messages.push({
        id: uid(),
        from: me,
        to: action.to,
        text: action.text.trim(),
        created: new Date().toISOString(),
        read: false,
      });
      notify(action.to, "Nova mensagem de " + user.name, "chat", me);
      break;
    }
    case "deleteMessage":
      s.messages = s.messages.filter(
        (m) => !(m.id === action.id && m.from === me),
      );
      break;
    case "readMessages":
      s.messages.forEach((m) => {
        if (m.from === action.from && m.to === me) m.read = true;
      });
      break;
    case "readNotice":
      s.notices.forEach((n) => {
        if (n.user === me && (!action.id || n.id === action.id)) n.read = true;
      });
      break;
    case "ticket":
      if (!action.ticket.text.trim())
        throw new Error("Descreva o que aconteceu.");
      s.tickets.unshift({ ...action.ticket, user: me });
      break;
    case "withdraw":
      if (
        user.role !== "profissional" ||
        !Number.isFinite(action.value) ||
        action.value < 0.01 ||
        action.value > wallet(s, me).available
      )
        throw new Error(
          "Informe um valor dentro do saldo disponível, a partir de R$ 0,01.",
        );
      s.withdrawals.unshift({
        id: uid(),
        user: me,
        value: Math.round(action.value * 100) / 100,
        created: new Date().toISOString(),
      });
      break;
  }
  return s;
}
