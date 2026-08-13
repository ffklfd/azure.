const KV_KEY = "links";

const DEFAULT_LINKS = [
  {
    id: "ig",
    label: "إنستجرام",
    url: "https://www.instagram.com/azure.egy?igsh=YjdpaHc1d2wwZzhy",
    icon: "instagram",
    order: 0,
  },
  {
    id: "wa",
    label: "واتساب",
    url: "https://wa.me/201129058069",
    icon: "whatsapp",
    order: 1,
  },
  {
    id: "call",
    label: "اتصل بينا",
    url: "tel:+201129058069",
    icon: "phone",
    order: 2,
  },
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function getLinks(env) {
  const raw = await env.LINKS_KV.get(KV_KEY);
  if (!raw) {
    await env.LINKS_KV.put(KV_KEY, JSON.stringify(DEFAULT_LINKS));
    return DEFAULT_LINKS;
  }
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : DEFAULT_LINKS;
  } catch {
    return DEFAULT_LINKS;
  }
}

async function saveLinks(env, links) {
  links.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  await env.LINKS_KV.put(KV_KEY, JSON.stringify(links));
  return links;
}

function makeId() {
  return crypto.randomUUID().split("-")[0];
}

async function handleLinksGet(env) {
  const links = await getLinks(env);
  return json({ ok: true, links });
}

async function handleLinksPost(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "طلب غير صالح" }, 400);
  }

  const { password, action, payload } = body || {};

  if (!password || password !== env.ADMIN_PASSWORD) {
    return json({ ok: false, error: "كلمة السر غلط" }, 401);
  }

  let links = await getLinks(env);

  switch (action) {
    case "add": {
      if (!payload?.label || !payload?.url) {
        return json({ ok: false, error: "لازم اسم ولينك" }, 400);
      }
      const newLink = {
        id: makeId(),
        label: String(payload.label).trim(),
        url: String(payload.url).trim(),
        icon: payload.icon || "link",
        order: links.length,
      };
      links.push(newLink);
      break;
    }

    case "update": {
      const idx = links.findIndex((l) => l.id === payload?.id);
      if (idx === -1) return json({ ok: false, error: "اللينك مش موجود" }, 404);
      links[idx] = {
        ...links[idx],
        label: payload.label ?? links[idx].label,
        url: payload.url ?? links[idx].url,
        icon: payload.icon ?? links[idx].icon,
      };
      break;
    }

    case "delete": {
      links = links.filter((l) => l.id !== payload?.id);
      links.forEach((l, i) => (l.order = i));
      break;
    }

    case "reorder": {
      if (!Array.isArray(payload?.order)) {
        return json({ ok: false, error: "ترتيب غير صالح" }, 400);
      }
      const map = new Map(links.map((l) => [l.id, l]));
      links = payload.order
        .filter((id) => map.has(id))
        .map((id, i) => ({ ...map.get(id), order: i }));
      break;
    }

    default:
      return json({ ok: false, error: "أمر غير معروف" }, 400);
  }

  links = await saveLinks(env, links);
  return json({ ok: true, links });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/links") {
      if (request.method === "GET") return handleLinksGet(env);
      if (request.method === "POST") return handleLinksPost(request, env);
      return new Response("Method not allowed", { status: 405 });
    }

    return env.ASSETS.fetch(request);
  },
};
