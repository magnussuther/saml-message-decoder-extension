/* global window: false */
/* global document: false */
/* global $: false */
/* global localStorage: false */
/* global chrome: false */
/* global browser: false */

import 'jquery-mousewheel';

// scrolloverflow is imported in webpack.config.js instead, otherwise
// ISCroll won't be globally accessible.
// import IScroll from 'fullpage.js/vendors/scrolloverflow.js';

import 'fullpage.js/dist/jquery.fullpage.css';
import 'fullpage.js/dist/jquery.fullpage';

import Mustache from 'mustache';

import {
  html as beautifyHtml,
} from 'js-beautify';

import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

import './static/roboto.woff2';
import './style.css';

let toggleNextPrevButtons = () => {};

let browserApi = null;
if (chrome) {
  browserApi = chrome;
} else {
  browserApi = browser;
}

const preprocessMessages = (messages) => {
  const preprocessedMessages = [];
  $.each(messages, (i, message) => {
    preprocessedMessages.push(message);
    const index = i + 1;
    preprocessedMessages[preprocessedMessages.length - 1].index = index;
    preprocessedMessages[preprocessedMessages.length - 1]
      .formattedContent = beautifyHtml(message.content, {
        indent_size: 2,
        // wrap_line_length: 100,
        brace_style: 'expand',
        wrap_attributes: 'force-aligned',
      });
  });

  return preprocessedMessages;
};

const renderView = (messages, scrollingDirection) => {
  let direction = 'horizontal';
  if (scrollingDirection === 'vertically') {
    direction = 'vertical';
  }

  const template = $(`#${direction}-message-template`).html();
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
  });

  $('#main-container').fullpage({
    // Allows us to scroll vertically inside a section/slide
    scrollOverflow: true,
    scrollOverflowOptions: {
      disablePointer: true,
    },
    loopHorizontal: false,
    controlArrows: false,
    afterSlideLoad: (anchorLink, index, slideAnchor, slideIndex) => {
      toggleNextPrevButtons = (event) => {
        if (event.pageX < 80 && slideIndex !== 0) {
          $('.nav-prev').show();
        } else if (event.pageX > window.innerWidth - 80 && slideIndex !== messages.length - 1) {
          // do something
          $('.nav-next').show();
        } else {
          $('.nav-prev').hide();
          $('.nav-next').hide();
        }
      };
    },
  });

  if (direction === 'horizontal') {
    $.fn.fullpage.moveTo(1, messages.length - 1); // last slide, first and only section
  } else {
    $.fn.fullpage.moveTo(messages.length, 0); // last section, first and only slide
  }
};

$(document).ready(() => {
  let messages = [];

  messages = localStorage.messages;
  if (messages && messages.length > 0) {
    messages = JSON.parse(messages);
    messages = preprocessMessages(messages);

    if (browserApi.storage) {
      browserApi.storage.local.get({
        scrollingDirection: '',
      }, (items) => {
        renderView(messages, items.scrollingDirection);
      });
    } else {
      renderView(messages, 'horizontally');
    }
  } else {
    const template = $('#nothing-to-display-template').html();
    const rendered = Mustache.render(template);
    $('#main-container').html(rendered);
  }
});

$(document).keydown((e) => {
  switch (e.key) {
    case 'ArrowUp':
      $.fn.fullpage.moveSlideLeft();
      break;

    case 'ArrowDown':
      $.fn.fullpage.moveSlideRight();
      break;

    default:
      return;
  }

  e.preventDefault(); // prevent the default action (scroll / move caret)
});

$(document).mousewheel((event) => {
  if (event.deltaX < 0) {
    $.fn.fullpage.moveSlideLeft();
  }
  if (event.deltaX > 0) {
    $.fn.fullpage.moveSlideRight();
  }
});

$(document).on('mousemove', (event) => {
  toggleNextPrevButtons(event);
});

$('.nav-prev').click(() => {
  $.fn.fullpage.moveSlideLeft();
});

$('.nav-next').click(() => {
  $.fn.fullpage.moveSlideRight();
});
