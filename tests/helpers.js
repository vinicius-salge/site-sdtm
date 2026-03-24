export function mockReq({ method = 'POST', body = {}, user = null, token = null } = {}) {
  return {
    method,
    body,
    user,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
}

export function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
  };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.body = data; return res; };
  res.setHeader = (key, value) => { res.headers[key] = value; return res; };
  res.end = () => res;
  return res;
}
