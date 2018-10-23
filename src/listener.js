/* global window: false */
/* global localStorage: false */
/* global URL: false */
/* global URLSearchParams: false */
/* global chrome: false */
/* global browser: false */
/* global $: false */
/* global Blob: false */
/* global TextDecoder: false */

import pako from 'pako';

let browserApi = null;
if (chrome) {
  browserApi = chrome;
} else {
  browserApi = browser;
}

const storeInLocalStorage = (message) => {
  console.log('Storing message in LocalStorage');

  let storedMessages = [];
  if (localStorage.messages && localStorage.messages.length !== 0) {
    storedMessages = JSON.parse(localStorage.messages);
  }

  storedMessages.push(message);

  browserApi.storage.local.get({
    maxNumberOfStoredMessages: 10, // default
  }, (items) => {
    if (storedMessages.length > items.maxNumberOfStoredMessages) {
      storedMessages = storedMessages.slice(storedMessages.length
        - items.maxNumberOfStoredMessages, storedMessages.length);
    }

    localStorage.messages = JSON.stringify(storedMessages);
  });
};

const processSamlRedirectBindingMessage = (data) => {
  const url = new URL(data.url);

  if (url.search !== '') {
    const request = url.searchParams.get('SAMLRequest');
    const response = url.searchParams.get('SAMLResponse');

    if (!request && !response) {
      console.log('Not a SAML message, aborting');
      return;
    }

    const message = request || response;

    // The request is URL decoded already
    const base64Decoded = window.atob(message);
    const inflatedBytes = pako.inflateRaw(base64Decoded, { to: 'string' });
    const inflated = decodeURIComponent(inflatedBytes);

    const parameters = [];
    url.searchParams.forEach((value, name) => {
      parameters.push({ name, value });
    });

    storeInLocalStorage({
      time: new Date().toUTCString(),
      parameter: request ? 'SAMLRequest' : 'SAMLResponse',
      binding: 'redirect',
      content: inflated,
      parameters,
    });
  }
};

const parseRawPostData = (formData, arrayBufferList) => {
  const form = formData || {};

  let decodedString = '';
  for (let i = 0; i !== arrayBufferList.length; i += 1) {
    const dv = new DataView(arrayBufferList[i].bytes);
    const decoder = new TextDecoder();
    const partial = decoder.decode(dv);
    decodedString += partial;
  }

  const params = new URLSearchParams(decodedString);

  for(const param of params.entries()) {
    form[param[0]] = decodeURIComponent(param[1]);
  }

  return form;
};

const extractPostedMessageParameter = (formData) => {
  const recognizedParameters = ['SAMLRequest', 'SAMLResponse', 'EidSignRequest', 'EidSignResponse'];

  let message = null;
  let parameter = null;

  recognizedParameters.forEach((param) => {
    const msg = formData[param];
    if (msg) {
      parameter = param;
      message = msg;
    }
  });

  return { message, parameter };
};

const processSamlPostBindingMessage = (data) => {
  const body = data.requestBody;
  if (body) {
    let formData = body.formData;

    if (body.raw) {
      console.log('POST parameters sent as ArrayBuffers, parsing...');
      formData = parseRawPostData(formData, body.raw);
    }
      
    if (!formData) {
      console.log('Missing POST parameters, aborting');
      return;
    }

    const { message, parameter } = extractPostedMessageParameter(formData);

    if (!message) {
      console.log('Not a recognized message, aborting');
      return;
    }

    var decoded = window.atob(message);
    if (decoded.indexOf("xml version") == -1) {
      const inflatedBytes = pako.inflateRaw(decoded, { to: 'string' });
      const inflated = decodeURIComponent(inflatedBytes);
      decoded = inflated;
    }
    const parameters = [];
    for (const [name, value] of Object.entries(formData)) {
      parameters.push({ name, value });
    }

    storeInLocalStorage({
      time: new Date().toUTCString(),
      parameter,
      binding: 'post',
      content: decoded,
      parameters,
    });
  }
};

const renderContextMenu = () => {
  browserApi.contextMenus.removeAll();

  browserApi.storage.local.get({
    scrollingDirection: 'horizontally', // default
    maxNumberOfStoredMessages: 10,
  }, (items) => {
    browserApi.contextMenus.create({
      title: 'Export stored messages',
      contexts: ['browser_action'],
      onclick: () => {
        const msgs = JSON.stringify(JSON.parse(localStorage.messages), null, 2);
        const blob = new Blob([msgs], { type: 'text/json;charset=utf-8' });
        browserApi.downloads.download({
          url: URL.createObjectURL(blob), // data: URLs doesn't work in Firefox
          filename: 'SAML Message Decoder Export.json',
          saveAs: true,
        });
      },
    });

    browserApi.contextMenus.create({
      title: `${items.maxNumberOfStoredMessages === 10 ? '\u2611' : '\u2610'} Keep 10 last messages only (default)`,
      contexts: ['browser_action'],
      onclick: () => {
        browserApi.storage.local.set({
          maxNumberOfStoredMessages: 10,
        });

        renderContextMenu();
      },
    });

    browserApi.contextMenus.create({
      title: `${items.maxNumberOfStoredMessages === 100 ? '\u2611' : '\u2610'} Keep 100 last messages`,
      contexts: ['browser_action'],
      onclick: () => {
        browserApi.storage.local.set({
          maxNumberOfStoredMessages: 100,
        });

        renderContextMenu();
      },
    });

    browserApi.contextMenus.create({
      title: 'Clear stored messages',
      contexts: ['browser_action'],
      onclick: () => {
        localStorage.messages = [];
      },
    });
  });
};

$().ready(() => {
  browserApi.webRequest.onBeforeRequest.addListener(
    (data) => {
      if (data.method === 'GET') {
        processSamlRedirectBindingMessage(data);
      }

      if (data.method === 'POST') {
        processSamlPostBindingMessage(data);
      } else {
        // Ignore (not supported or not our business)
      }
    }, {
      urls: ['<all_urls>'],
    }, ['requestBody'],
  );


  renderContextMenu();
});
