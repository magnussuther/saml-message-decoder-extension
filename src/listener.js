/* global window: false */
/* global document: false */
/* global localStorage: false */
/* global URL: false */
/* global chrome: false */
/* global browser: false */
/* global $: false */
/* global btoa: false */

import pako from 'pako';

let browserApi = null;
if (chrome) {
  browserApi = chrome;
} else {
  browserApi = browser;
}

function storeInLocalStorage(message) {
  console.log('storeInLocalStorage: incoming message: ', message);

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
}

const processSamlRedirectBindingMessage = (data) => {
  const url = new URL(data.url);

  if (url.search !== '') {
    // console.log('processSamlRedirectBindingMessage: ', url.search);
    const request = url.searchParams.get('SAMLRequest');
    const response = url.searchParams.get('SAMLResponse');

    if (!request && !response) {
      // console.log('processSamlRedirectBindingMessage: ', 'Nothing interesting here... no-op');
      return;
    }

    const message = request || response;
    console.log('processSamlRedirectBindingMessage: message: ', message);

    // The request is URL decoded already
    const base64Decoded = window.atob(message);
    // console.log('processSamlRedirectBindingMessage: base64Decoded: ', base64Decoded);

    const inflatedBytes = pako.inflateRaw(base64Decoded, { to: 'string' });
    // console.log('processSamlRedirectBindingMessage: inflatedBytes: ', inflatedBytes);

    // const escaped = escape(inflatedBytes);
    // console.log('processSamlRedirectBindingMessage: escaped: ', escaped);

    const inflated = decodeURIComponent(inflatedBytes);
    // console.log('processSamlRedirectBindingMessage: inflated: ', inflated);

    const parameters = [];
    url.searchParams.forEach((value, name) => {
      parameters.push({ name, value });
    });

    // if (url.searchParams.get('RelayState')) {
    //   parameters.push({ name: 'relayState', value: url.searchParams.get('RelayState') });
    // }
    // if (url.searchParams.get('SigAlg')) {
    //   parameters.push({ name: 'sigAlg', value: url.searchParams.get('SigAlg') });
    // }
    // if (url.searchParams.get('Signature')) {
    //   parameters.push({ name: 'signature', value: url.searchParams.get('Signature') });
    // }

    storeInLocalStorage({
      time: new Date().toUTCString(),
      parameter: request ? 'SAMLRequest' : 'SAMLResponse',
      binding: 'redirect',
      content: inflated,
      parameters,
    });
  }
};

function processSamlPostBindingMessage(data) {
  const body = data.requestBody;
  if (body) {
    const formData = body.formData;

    if (formData) {
      console.log('processSamlPostBindingMessage: ', formData);
      const request = formData.SAMLRequest;
      const response = formData.SAMLResponse;

      if (!request && !response) {
        // Nothing to us to see here
        return;
      }

      const message = request || response;
      const decoded = window.atob(message);

      const parameters = [];
      for (const [name, value] of Object.entries(formData)) {
        parameters.push({ name, value });
      }

      storeInLocalStorage({
        time: new Date().toUTCString(),
        parameter: request ? 'SAMLRequest' : 'SAMLResponse',
        binding: 'post',
        content: decoded,
        parameters,
      });
    }
  }
}

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
        console.log('msgs: ', msgs);
        const blob = new Blob([msgs], { type: 'text/json;charset=utf-8' });
        browserApi.downloads.download({
          url: URL.createObjectURL(blob), // data: URLs doesn't work in Firefox
          filename: 'SAML Message Decoder Export.json',
          saveAs: true,
        });
      },
    });

    browserApi.contextMenus.create({
      title: `${items.scrollingDirection === 'horizontally' ? '\u2611' : '\u2610'} Scroll horizontally (default)`,
      contexts: ['browser_action'],
      onclick: () => {
        browserApi.storage.local.set({
          scrollingDirection: 'horizontally',
        });

        renderContextMenu();
      },
    });

    browserApi.contextMenus.create({
      title: `${items.scrollingDirection === 'vertically' ? '\u2611' : '\u2610'} Scroll vertically`,
      contexts: ['browser_action'],
      onclick: () => {
        browserApi.storage.local.set({
          scrollingDirection: 'vertically',
        });

        renderContextMenu();
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
