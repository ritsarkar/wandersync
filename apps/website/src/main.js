// BrowserMCP Showcase Interactive Controller

const SIMULATION_DATA = {
  navigate: {
    request: {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "browser_navigate",
        arguments: {
          url: "https://news.ycombinator.com",
          newTab: false
        }
      }
    },
    bridgeMessage: {
      id: "req-nav-01",
      type: "EXECUTE_ACTION",
      payload: {
        action: "navigate",
        params: { url: "https://news.ycombinator.com" }
      }
    },
    response: {
      success: true,
      data: {
        url: "https://news.ycombinator.com",
        title: "Hacker News",
        status: "complete"
      }
    }
  },
  get_dom: {
    request: {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "browser_get_dom",
        arguments: {
          maxElements: 50,
          highlightInteractive: true
        }
      }
    },
    bridgeMessage: {
      id: "req-dom-02",
      type: "EXECUTE_ACTION",
      payload: {
        action: "get_dom",
        params: { maxElements: 50, highlightInteractive: true }
      }
    },
    response: {
      url: "https://news.ycombinator.com",
      title: "Hacker News",
      elementCount: 3,
      interactiveElements: [
        { ref: "@e1", tagName: "a", text: "Hacker News", href: "https://news.ycombinator.com" },
        { ref: "@e2", tagName: "a", text: "new | past | comments | ask | show | jobs" },
        { ref: "@e3", tagName: "a", text: "1. Anthropic releases Model Context Protocol" }
      ],
      formattedTree: "[@e1] <a href=\"https://news.ycombinator.com\"> \"Hacker News\"\n[@e2] <a href=\"newest\"> \"new | past | comments\"\n[@e3] <a href=\"item?id=38491\"> \"1. Anthropic releases Model Context Protocol\""
    }
  },
  click: {
    request: {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "browser_click",
        arguments: {
          ref: "@e3"
        }
      }
    },
    bridgeMessage: {
      id: "req-clk-03",
      type: "EXECUTE_ACTION",
      payload: {
        action: "click",
        params: { ref: "@e3" }
      }
    },
    response: {
      clicked: true,
      ref: "@e3",
      targetTag: "a",
      navigated: true
    }
  },
  type: {
    request: {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "browser_type",
        arguments: {
          selector: "input[name=\"q\"]",
          text: "AI agent browser control",
          pressEnter: true
        }
      }
    },
    bridgeMessage: {
      id: "req-typ-04",
      type: "EXECUTE_ACTION",
      payload: {
        action: "type",
        params: { selector: "input[name=\"q\"]", text: "AI agent browser control", pressEnter: true }
      }
    },
    response: {
      typed: true,
      textLength: 24,
      submitted: true
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const simButtons = document.querySelectorAll('.sim-action-btn');
  const reqCode = document.getElementById('sim-request-code');
  const resCode = document.getElementById('sim-response-code');
  const copyConfigBtn = document.getElementById('btn-copy-config');

  simButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      simButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const actionKey = btn.getAttribute('data-sim');
      const data = SIMULATION_DATA[actionKey];

      if (data && reqCode && resCode) {
        reqCode.textContent = JSON.stringify(data.request, null, 2);
        resCode.textContent = '// Browser Bridge & DOM Response\n' + JSON.stringify(data.response, null, 2);
      }
    });
  });

  // Default simulation load
  if (simButtons[0]) {
    simButtons[0].click();
  }

  // Copy config button
  copyConfigBtn?.addEventListener('click', () => {
    const configText = document.getElementById('claude-config-code')?.textContent || '';
    navigator.clipboard.writeText(configText).then(() => {
      copyConfigBtn.textContent = 'Copied to Clipboard!';
      setTimeout(() => {
        copyConfigBtn.textContent = 'Copy Configuration';
      }, 2000);
    });
  });
});
