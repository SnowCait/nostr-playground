const secp = window.nobleSecp256k1;

/** @type WebSocket */
let ws;
let nip07 = false;

const getURL = () => {
  const inputUrl = document.getElementById('relay').value;

  try {
    return new URL(inputUrl);
  } catch (error) {
    if (error instanceof TypeError) {
      console.log('Invalid URL');
      return null;
    } else {
      throw error;
    }
  }
};

const info = async (/** @type {URL} */ url) => {
  const httpUrl = url.href.replace('wss://', 'https://').replace('ws://', 'http://');
  console.log(httpUrl);

  let text = 'NIP-11 is not supported.';
  try {
    const response = await fetch(httpUrl, {
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

const displayEvent = (/** @type {string} */ text) => {
  const item = document.createElement('li');
  const previewPre = document.createElement('pre');
  const previewCode = document.createElement('code');
  if (text.startsWith('[')) {
    const message = JSON.parse(text);
    const [ type, subscriptionId, event ] = message;
    if (event !== undefined) {
      previewCode.textContent = JSON.stringify([
        type,
        subscriptionId,
        {
          kind: event.kind,
          content: event.content,
          tags: event.tags,
        },
      ]);
      previewPre.append(previewCode);
      previewPre.addEventListener('click', () => {
        console.log(event.id);
        const target = document.getElementById(event.id);
        console.log(target);
        if (target.classList.contains('hidden')) {
          target.classList.remove('hidden');
        } else {
          target.classList.add('hidden');
        }
      });
      item.append(previewPre);

      const more = document.createElement('span');
      more.textContent = 'more...';
      more.classList.add('more');
      previewPre.append(more);

      const jsonCode = document.createElement('code');
      jsonCode.textContent = JSON.stringify(message, null, 2);
      const jsonPre = document.createElement('pre');
      jsonPre.id = event.id;
      jsonPre.classList.add('json');
      jsonPre.classList.add('hidden');
      jsonPre.append(jsonCode);
      item.append(jsonPre);
    } else {
      previewCode.textContent = text;
      previewPre.append(previewCode);
      item.append(previewPre);
    }
  } else {
    previewCode.textContent = text;
    previewPre.append(previewCode);
    item.append(previewPre);
  }

  const list = document.getElementById('events');
  list.prepend(item);
};

const connect = (/** @type {URL} */ url) => {
  console.log(ws);
  if (ws && ws.readyState === ws.OPEN) {
    console.log(`Disconnect ${ws.url}`);
    ws.close();
  }

  ws = new WebSocket(url.href);
  console.log(`Connect ${ws.url}`);
  ws.onerror = event => {
    console.error(event);
    displayEvent(`ERROR`);
  };
  ws.onopen = event => {
    console.log(event);
    displayEvent(`OPEN ${ws.url}`);
    document.getElementById('send-button').toggleAttribute('disabled', false);
  };
  ws.onclose = event => {
    console.log(event);
    displayEvent(`CLOSE code: ${event.code}, reason: ${event.reason}`);
    document.getElementById('send-button').toggleAttribute('disabled', true);
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
  if (['AUTH', 'EVENT'].includes(command[0])) {
    if (nip07) {
      const event = command[1];
      command[1] = await window.nostr.signEvent({
        created_at: Math.round(Date.now() / 1000),
        kind: event.kind,
        tags: event.tags,
        content: event.content,
      });
      console.log('[NIP-07]', command[1]);
    } else {
      command[1] = await generate(command[1]);
    }
  }
  const sendJson = JSON.stringify(command);
  console.log('[send json]', sendJson);
  displayEvent(sendJson);
  ws.send(sendJson);
};

const run = async () => {
  const url = getURL();
  if (url === null) {
    return;
  }
  console.log(url);
  await info(url);
  await connect(url);
};

const setJsonTemplate = type => {
  let json = null;
  switch (type) {
    case 'AUTH': {
      json = JSON.stringify([
        'AUTH',
        {
          id: '<generated>',
          pubkey: '<generated>',
          created_at: '<generated>',
          kind: 22242,
          tags: [
            ['relay', getURL() ?? ''],
            ['challenge', '']
          ],
          content: '',
          sig: '<generated>',
        },
      ], null, 2);
      break;
    }
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
        {
          limit: 100,
        },
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
    if (['AUTH', 'EVENT'].includes(type) && !nip07) {
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

  document.getElementById('nip-07').addEventListener('click', event => {
    console.log(event.type);

    const warning = document.getElementById('nip-07-warning');
    if (window.nostr === undefined) {
      warning.classList.remove('hidden');
    } else {
      warning.classList.add('hidden');
      document.getElementById('private-key-input').classList.add('hidden');
      nip07 = true;
      sessionStorage.setItem('NIP-07', nip07);
    }
  });
});

window.addEventListener('load', async () => {
  console.log('load');

  if (sessionStorage.getItem('NIP-07') === 'true' && window.nostr !== undefined) {
    console.log('NIP-07 is enabled')
    nip07 = true;
    document.getElementById('private-key-input').classList.add('hidden');
  }
});
