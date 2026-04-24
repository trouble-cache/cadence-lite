const crypto = require("node:crypto");

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function parseBasicAuthHeader(header) {
  if (!header?.startsWith("Basic ")) {
    return null;
  }

  const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
  const separatorIndex = decoded.indexOf(":");

  if (separatorIndex === -1) {
    return null;
  }

  return {
    username: decoded.slice(0, separatorIndex),
    password: decoded.slice(separatorIndex + 1),
  };
}

function isAuthorized(req, secret) {
  if (!secret) {
    return false;
  }

  const auth = parseBasicAuthHeader(req.headers.authorization);

  if (!auth) {
    return false;
  }

  const provided = Buffer.from(auth.password);
  const expected = Buffer.from(secret);

  if (provided.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(provided, expected);
}

function sendAuthRequired(res) {
  res.writeHead(401, {
    "Content-Type": "text/plain; charset=utf-8",
    "WWW-Authenticate": 'Basic realm="Cadence Admin"',
  });
  res.end("Authentication required.");
}

function redirect(res, location) {
  res.writeHead(303, { Location: location });
  res.end();
}

function parseUrlEncoded(body) {
  const params = new URLSearchParams(body.toString("utf8"));
  return Object.fromEntries(params.entries());
}

function parseMultipartFormData(body, contentType) {
  const boundaryMatch = contentType.match(/boundary=([^;]+)/i);

  if (!boundaryMatch) {
    throw new Error("Missing multipart boundary.");
  }

  const boundary = `--${boundaryMatch[1]}`;
  const parts = body.toString("utf8").split(boundary).slice(1, -1);
  const fields = {};
  const files = {};

  for (const rawPart of parts) {
    const part = rawPart.replace(/^\r?\n/, "").replace(/\r?\n$/, "");
    const separatorIndex = part.indexOf("\r\n\r\n");

    if (separatorIndex === -1) {
      continue;
    }

    const headerText = part.slice(0, separatorIndex);
    const valueText = part.slice(separatorIndex + 4).replace(/\r\n$/, "");
    const headers = headerText.split("\r\n");
    const disposition = headers.find((line) => line.toLowerCase().startsWith("content-disposition:"));

    if (!disposition) {
      continue;
    }

    const nameMatch = disposition.match(/name="([^"]+)"/i);
    const fileMatch = disposition.match(/filename="([^"]*)"/i);

    if (!nameMatch) {
      continue;
    }

    const fieldName = nameMatch[1];

    if (fileMatch && fileMatch[1]) {
      const fileEntry = {
        filename: fileMatch[1],
        content: valueText,
      };

      if (!files[fieldName]) {
        files[fieldName] = fileEntry;
        continue;
      }

      if (Array.isArray(files[fieldName])) {
        files[fieldName].push(fileEntry);
        continue;
      }

      files[fieldName] = [files[fieldName], fileEntry];
      continue;
    }

    fields[fieldName] = valueText;
  }

  return {
    fields,
    files,
  };
}

async function parseRequestForm(req) {
  const body = await readRequestBody(req);
  const contentType = req.headers["content-type"] || "";

  if (contentType.includes("multipart/form-data")) {
    return parseMultipartFormData(body, contentType);
  }

  return {
    fields: parseUrlEncoded(body),
    files: {},
  };
}

module.exports = {
  readRequestBody,
  parseBasicAuthHeader,
  isAuthorized,
  sendAuthRequired,
  redirect,
  parseUrlEncoded,
  parseMultipartFormData,
  parseRequestForm,
};
