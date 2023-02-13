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

const send = async () => {
  const json = document.getElementById('json').value;
  console.log(json);
  displayEvent(JSON.stringify(JSON.parse(json)));
  ws.send(json);
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
});
