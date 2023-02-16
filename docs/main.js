const secp = window.nobleSecp256k1;

/** @type WebSocket */
let ws;

const getHost = () => {
  const inputUrl = document.getElementById('relay').value;

  try {
    return new URL(inputUrl).host;
  } catch (error) {
    if (error instanceof TypeError) {
      console.log('Invalid URL');
      return null;
    } else {
      throw error;
    }
  }
};

const info = async host => {
  const url = `https://${host}`;
  console.log(url);

  let text = 'NIP-11 is not supported.';
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/nostr+json',
      },
    });

    if (!response.ok) {
      console.error(text);
    }

    const json = await response.json();
    text = JSON.stringify(json, null, 2);
    console.log(text);
  } catch (error) {
    console.error(text);
  }

  document.getElementById('info').textContent = text;
};

const displayEvent = text => {
  const code = document.createElement('code');
  code.textContent = text;

  const pre = document.createElement('pre');
  pre.append(code);

  const item = document.createElement('li');
  item.append(pre);

  const list = document.getElementById('events');
  list.prepend(item);
};

const connect = host => {
  const url = `wss://${host}`;
  console.log(url);
  ws = new WebSocket(url);
  ws.onerror = event => {
    console.error(event);
    displayEvent(`ERROR`);
  };
  ws.onopen = event => {
    console.log(event);
    displayEvent(`OPEN ${ws.url}`);
  };
  ws.onclose = event => {
    console.log(event);
    displayEvent(`CLOSE code: ${event.code}, reason: ${event.reason}`);
  };
  ws.onmessage = event => {
    console.log(event.type, event.data);
    displayEvent(event.data);
  };
};

const generate = async (input) => {
  const { kind, tags, content } = input;
  if (kind === undefined || tags === undefined || content === undefined) {
    return input;
  }

  /** @type {string} */
  const privateKey = document.getElementById('private-key').value;
  const publicKey = secp.utils.bytesToHex(secp.schnorr.getPublicKey(privateKey));
  console.log('[private key]', privateKey);
  console.log('[public key]', publicKey);
  const createdAt = Math.round(Date.now() / 1000);
  const json = JSON.stringify([
    0,
    publicKey,
    createdAt,
    kind,
    tags,
    content,
  ]);
  console.log('[json]', json);
  const id = secp.utils.bytesToHex(await secp.utils.sha256(new TextEncoder().encode(json)));
  console.log('[id]', id);
  const sig = secp.utils.bytesToHex(await secp.schnorr.sign(id, privateKey));
  console.log('[sig]', sig);
  return {
    id,
    pubkey: publicKey,
    created_at: createdAt,
    kind,
    tags,
    content,
    sig,
  };
};

const send = async () => {
  const inputJson = document.getElementById('send-json').value;
  console.log('[input json]', inputJson);
  let command = JSON.parse(inputJson);
  if (command[0] === 'EVENT') {
    command[1] = await generate(command[1]);
  }
  const sendJson = JSON.stringify(command);
  console.log('[send json]', sendJson);
  displayEvent(sendJson);
  ws.send(sendJson);
};

const run = async () => {
  const host = getHost();
  if (host === null) {
    return;
  }
  console.log(host);
  await info(host);
  await connect(host);
};

const setJsonTemplate = type => {
  let json = null;
  switch (type) {
    case 'EVENT':
      json = JSON.stringify([
        'EVENT',
        {
          id: '<generated>',
          pubkey: '<generated>',
          created_at: '<generated>',
          kind: 1,
          tags: [],
          content: '',
          sig: '<generated>',
        },
      ], null, 2);
      break;
    case 'REQ':
      json = JSON.stringify([
        'REQ',
        Math.floor(Math.random() * 99999).toString(),
        {},
      ], null, 2);
      break;
    case 'CLOSE':
      let subscriptionId = '';
      try {
        const previousJson = JSON.parse(document.getElementById('send-json').value);
        if (previousJson[0] === 'REQ') {
          subscriptionId = previousJson[1];
        }
      } catch (error) {
        console.debug(error);
      }
      json = JSON.stringify([
        'CLOSE',
        subscriptionId,
      ], null, 2);
      break;
  }

  if (json !== null) {
    document.getElementById('send-json').value = json;

    const privateKeyInput = document.getElementById('private-key-input');
    if (type === 'EVENT') {
      privateKeyInput.classList.remove(['hidden']);
    } else {
      privateKeyInput.classList.add(['hidden']);
    }
  }
};

document.addEventListener('DOMContentLoaded', async event => {
  console.log(event.type);

  document.getElementById('connect').addEventListener('submit', async event => {
    console.log(event.type);
    event.preventDefault();
    await run();
  });

  document.getElementById('send').addEventListener('submit', async event => {
    console.log(event.type);
    event.preventDefault();
    await send();
  });

  document.getElementById('type').addEventListener('change', event => {
    console.log(event.type, event.target.value);
    setJsonTemplate(event.target.value);
  });
});
