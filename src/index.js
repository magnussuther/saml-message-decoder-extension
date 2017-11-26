/* global window: false */
/* global document: false */
/* global $: false */
/* global localStorage: false */

import 'jquery-mousewheel';
import Mustache from 'mustache';

import {
  html as beautifyHtml,
} from 'js-beautify';

import Clipboard from 'clipboard/dist/clipboard';

import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

import 'primer-tooltips/build/build.css';

import './static/roboto.woff2';
import './style.css';

const preprocessMessages = (messages) => {
  const preprocessedMessages = [];
  $.each(messages, (i, message) => {
    preprocessedMessages.push(message);
    const index = i + 1;
    preprocessedMessages[preprocessedMessages.length - 1].index = index;
    preprocessedMessages[preprocessedMessages.length - 1]
      .formattedContent = beautifyHtml(message.content, {
        indent_size: 2,
        brace_style: 'expand',
        wrap_attributes: 'force-aligned',
      });
  });

  return preprocessedMessages;
};

const getCurrentlyVisibleMessageNumber = () => {
  const currentlyVisible = $('section.message-container:visible')[0];
  const currentIndex = $(currentlyVisible).data('message-container-index');
  return currentIndex;
};

const toggleNextPrevButtons = (event) => {
  const visibleMessageNumber = getCurrentlyVisibleMessageNumber();

  const numberOfMessages = $('section.message-container').length;

  if (event.pageX < 80 && visibleMessageNumber > 1) {
    $('.nav-prev').show();
  } else if (event.pageX > window.innerWidth - 80
      && visibleMessageNumber !== numberOfMessages) {
    $('.nav-next').show();
  } else {
    $('.nav-prev').hide();
    $('.nav-next').hide();
  }
};

const moveToMessageSection = (nextMessageNumber) => {
  if (!Number.isInteger(nextMessageNumber)) {
    console.error('nextMessageNumber is not a number', nextMessageNumber);
    return;
  }

  const $messageToDisplay = $(`[data-message-container-index=${nextMessageNumber}]`);
  if ($messageToDisplay.length === 0) {
    console.warn('Preventing navigation to out-of-range nextMessageNumber', nextMessageNumber);
    return;
  }

  $('section.message-container').hide();
  $messageToDisplay.show();
};

const renderView = (messages) => {
  const template = $('#horizontal-message-template').html();
  Mustache.parse(template);
  const messageTemplate = $('#single-message-template').html();
  Mustache.parse(messageTemplate);

  const rendered = Mustache.render(template, {
    messages,
  }, { message: messageTemplate });
  $('#main-container').html(rendered);

  hljs.initHighlightingOnLoad();
  $('pre code').each((i, block) => {
    hljs.highlightBlock(block);

    const $textNodes = $(block).contents()
      .filter((_, node) => node.nodeType === 3); // Text nodes

    $textNodes.wrap((index) => {
      const node = $textNodes[index];
      const text = $(node).text();
      const whitespace = text.replace(/\s/g, '').length === 0 ? '-whitespace' : '';
      const long = text.length > 200 ? '-long' : '';
      return `<span class="text-node${whitespace}${long}"></span>`;
    });
  });

  moveToMessageSection(messages.length); // Move to the last message
};

const attachEventListeners = () => {
  $('button.copy-messages-button').on('mouseleave', () => {
    $('button.copy-messages-button').removeClass('tooltipped tooltipped-s');
  });

  $('button.copy-messages-button').click((button) => {
    $('button.copy-messages-button').addClass('tooltipped tooltipped-s');
    const currentlyCheckedIndexes = $('input.message-copy-checkbox:checked')
      .map((i, e) => $(e).data('checkbox-index')).get();

    if (currentlyCheckedIndexes.length === 0) {
      // Only copy the one selected message
      currentlyCheckedIndexes.push($(button.currentTarget).data('message-index'));
    }

    const temporaryClipboardTarget = $('<div />');
    const sortedCurrentlyCheckedIndexes = currentlyCheckedIndexes.sort((a, b) => a - b);
    $.each(sortedCurrentlyCheckedIndexes, (i, messageIndex) => {
      temporaryClipboardTarget.append($(`code[data-message-index="${messageIndex}"]`).clone());
      temporaryClipboardTarget.append('<br>');
    });

    // Target must be in DOM and 'not hidden' for Clipboard to work
    $('#temp-container').append(temporaryClipboardTarget);
    const clipboard = new Clipboard('button.copy-messages-button', {
      target: () => temporaryClipboardTarget[0],
    });
    clipboard.on('success', (e) => {
      temporaryClipboardTarget.remove();
      e.clearSelection();
    });
    clipboard.on('error', (e) => {
      console.err('clipboard error', e);
      temporaryClipboardTarget.remove();
      e.clearSelection();
    });
  });

  $('input.message-copy-checkbox').on('change', () => {
    const currentlyCheckedIndexes = $('input.message-copy-checkbox:checked')
      .map((i, e) => $(e).data('checkbox-index')).get();

    if (currentlyCheckedIndexes.length === 0) {
      $('.copy-messages-button').text('Copy this message');
      $('.clear-copy-selections').hide();
    } else {
      $('.copy-messages-button').text(`Copy ${currentlyCheckedIndexes.length} messages`);
      $('.clear-copy-selections').show();
    }
  });

  $('.clear-copy-selections').click(() => {
    $('input.message-copy-checkbox').prop('checked', false).change();
  });
};

$(document).ready(() => {
  let messages = [];

  messages = localStorage.messages;
  if (messages && messages.length > 0) {
    messages = JSON.parse(messages);
    messages = preprocessMessages(messages);

    renderView(messages);
    attachEventListeners();
  } else {
    const template = $('#nothing-to-display-template').html();
    const rendered = Mustache.render(template);
    $('#main-container').html(rendered);
  }
});

$(document).keydown((e) => {
  const currentIndex = getCurrentlyVisibleMessageNumber();

  switch (e.key) {
    case 'ArrowUp':
    case 'ArrowLeft':
      moveToMessageSection(currentIndex - 1);
      break;

    case 'ArrowDown':
    case 'ArrowRight':
      moveToMessageSection(currentIndex + 1);
      break;

    default:
      return;
  }

  e.preventDefault(); // prevent the default action (scroll / move caret)
});

$(document).mousewheel((event) => {
  const currentIndex = getCurrentlyVisibleMessageNumber();

  if (event.deltaX < 0) {
    moveToMessageSection(currentIndex - 1);
    event.preventDefault();
  }
  if (event.deltaX > 0) {
    moveToMessageSection(currentIndex + 1);
    event.preventDefault();
  }
});

$(document).on('mousemove', (event) => {
  toggleNextPrevButtons(event);
});

$('.nav-prev').click(() => {
  const currentIndex = getCurrentlyVisibleMessageNumber();
  moveToMessageSection(currentIndex - 1);
});

$('.nav-next').click(() => {
  const currentIndex = getCurrentlyVisibleMessageNumber();
  moveToMessageSection(currentIndex + 1);
});
