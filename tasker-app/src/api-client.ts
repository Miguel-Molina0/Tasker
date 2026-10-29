export type Tokens = { access: string; refresh: string };
export type TokenStorage = { read(): Promise<Tokens | null>; write(value: Tokens | null): Promise<void> };
export class ApiError extends Error {
  constructor(message: string, public status = 0) { super(message); }
}
function errorText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(errorText).join(' ');
  if (value && typeof value === 'object') return Object.entries(value).map(([k,v]) =>
    ['detail','non_field_errors'].includes(k) ? errorText(v) : `${k}: ${errorText(v)}`).join('\n');
  return 'Não foi possível concluir a operação.';
}
export function createApiClient(baseUrl: string, storage: TokenStorage, fetcher: typeof fetch = fetch) {
  const base = baseUrl.replace(/\/+$/, '') + '/';
  let tokens: Tokens | null = null;
  let loaded = false;
  let refreshFlight: Promise<void> | null = null;
  let epoch = 0;
  let unauthorized: (() => void) | undefined;
  async function restore() {
    if (!loaded) { tokens = await storage.read(); loaded = true; }
    return tokens;
  }
  async function setTokens(value: Tokens | null) {
    epoch++;
    tokens = value; loaded = true;
    await storage.write(value);
  }
  async function send(path: string, method: string, body: unknown, token?: string) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetcher(base+path.replace(/^\//,''), { method, signal: controller.signal,
        headers: { Accept: 'application/json', ...(body !== undefined ? {'Content-Type':'application/json'} : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body) });
      let data: any = null;
      const text = await response.text();
      try { if (text) data = JSON.parse(text); } catch { /* HTML errors must not be exposed as UI text */ }
      return { response, data };
    } catch {
      throw new ApiError('Não foi possível conectar ao servidor. Confira a rede e o endereço da API. Se estava salvando, atualize a lista antes de repetir a operação.');
    } finally { clearTimeout(timer); }
  }
  async function renew() {
    if (!refreshFlight) {
      const generation = epoch;
      refreshFlight = (async () => {
        const current = await restore();
        if (!current) throw new ApiError('Entre novamente para continuar.',401);
        const {response,data} = await send('token/refresh/','POST',{refresh:current.refresh});
        if (generation !== epoch) throw new ApiError('A sessão foi alterada.',401);
        if (!response.ok || !data?.access) {
          if (response.status >= 500) throw new ApiError('Servidor indisponível para renovar a sessão.',response.status);
          await setTokens(null); unauthorized?.();
          throw new ApiError('Sua sessão expirou. Entre novamente.',401);
        }
        tokens={ access:data.access,refresh:data.refresh || current.refresh };
        await storage.write(tokens);
      })().finally(() => { refreshFlight=null; });
    }
    return refreshFlight;
  }
  async function request<T = any>(path: string, method = 'GET', body?: unknown, auth = true): Promise<T> {
    const generation = epoch;
    const current = auth ? await restore() : null;
    let result = await send(path,method,body,current?.access);
    if (auth && result.response.status===401 && current && generation===epoch) {
      await renew();
      result=await send(path,method,body,tokens?.access);
    }
    if (auth && generation !== epoch) throw new ApiError('A sessão foi alterada.',401);
    if (!result.response.ok) {
      if (auth && result.response.status===401) { await setTokens(null); unauthorized?.(); }
      throw new ApiError(result.data ? errorText(result.data) : `Servidor respondeu com erro ${result.response.status}.`,result.response.status);
    }
    return result.data as T;
  }
  return {
    baseUrl: base, request, restore,
    async login(username:string,password:string) {
      const result=await request<Tokens>('token/','POST',{username,password},false);
      if (!result?.access || !result?.refresh) throw new ApiError('Resposta de autenticação inválida.');
      await setTokens({access:result.access,refresh:result.refresh});
    },
    logout: () => setTokens(null),
    onUnauthorized(callback: () => void) { unauthorized=callback; },
    async socketUrl(peer:string) {
      // Renew before connecting: WebSocket middleware validates the access token at the handshake.
      await renew();
      const root=base.replace(/\/api\/$/,'/').replace(/^http/,'ws');
      return `${root}ws/conversa/${encodeURIComponent(peer)}/?token=${encodeURIComponent(tokens!.access)}`;
    },
  };
}
export type ApiClient = ReturnType<typeof createApiClient>;
