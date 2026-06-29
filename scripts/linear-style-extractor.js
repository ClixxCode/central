/*
 * Browser console helper for collecting Linear UI style evidence.
 *
 * Usage:
 * 1. Open the Linear test workspace screen you want to sample.
 * 2. Run this file's contents in the browser console.
 * 3. Switch Linear to the other theme and run it again.
 *
 * The output intentionally avoids visible text content. It samples computed
 * styles, component dimensions, root variables, and color frequency only.
 */

(() => {
  const styleProps = [
    'color',
    'backgroundColor',
    'borderColor',
    'boxShadow',
    'borderRadius',
    'fontFamily',
    'fontSize',
    'fontWeight',
    'lineHeight',
    'letterSpacing',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'height',
    'minHeight',
    'gap',
  ];

  const selectors = {
    body: 'body',
    root: '#root, #__next, main, [role="main"]',
    sidebar: 'nav, aside, [aria-label*="sidebar" i], [class*="sidebar" i], [class*="navigation" i]',
    sidebarItems: 'nav a, aside a, nav button, aside button, [aria-label*="sidebar" i] a, [aria-label*="sidebar" i] button',
    header: 'header, [class*="header" i], [class*="topbar" i]',
    buttons: 'button, [role="button"]',
    tabs: '[role="tab"], [aria-selected]',
    issueRows: '[role="row"], tr, li, [class*="issue" i], [class*="listItem" i]',
    inputs: 'input, textarea, [contenteditable="true"]',
    menusDialogs: '[role="menu"], [role="dialog"], [role="listbox"], [data-radix-popper-content-wrapper]',
  };

  const isVisible = (element) => {
    const rect = element.getBoundingClientRect();

    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.y > -40 &&
      rect.y < window.innerHeight + 40 &&
      rect.x > -40 &&
      rect.x < window.innerWidth + 40
    );
  };

  const styleFor = (element) => {
    const computed = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const output = {
      tag: element.tagName.toLowerCase(),
      role: element.getAttribute('role'),
      ariaSelected: element.getAttribute('aria-selected'),
      rect: {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
      },
    };

    for (const prop of styleProps) {
      output[prop] = computed[prop];
    }

    return output;
  };

  const sample = (selector, max = 12) =>
    Array.from(document.querySelectorAll(selector))
      .filter(isVisible)
      .slice(0, max)
      .map(styleFor);

  const getCssVars = () => {
    const names = new Set();

    const walkRules = (rules) => {
      for (const rule of Array.from(rules || [])) {
        if (rule.cssRules) {
          walkRules(rule.cssRules);
        }

        if (!rule.style) {
          continue;
        }

        for (const name of Array.from(rule.style)) {
          if (name.startsWith('--')) {
            names.add(name);
          }
        }
      }
    };

    for (const sheet of Array.from(document.styleSheets)) {
      try {
        walkRules(sheet.cssRules);
      } catch {
        // Ignore cross-origin stylesheets.
      }
    }

    const root = getComputedStyle(document.documentElement);
    const vars = {};

    for (const name of Array.from(names).sort()) {
      const value = root.getPropertyValue(name).trim();

      if (value && !value.startsWith('url(')) {
        vars[name] = value;
      }
    }

    return vars;
  };

  const collectColors = () => {
    const colorFreq = {};
    const add = (value) => {
      if (
        !value ||
        value === 'rgba(0, 0, 0, 0)' ||
        value === 'transparent' ||
        value === 'none'
      ) {
        return;
      }

      colorFreq[value] = (colorFreq[value] || 0) + 1;
    };

    for (const element of Array.from(document.querySelectorAll('body *')).slice(0, 2500)) {
      if (!isVisible(element)) {
        continue;
      }

      const computed = getComputedStyle(element);
      add(computed.color);
      add(computed.backgroundColor);
      add(computed.borderColor);
      add(computed.boxShadow);
      add(computed.outlineColor);
    }

    return Object.entries(colorFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 80)
      .map(([value, count]) => ({ value, count }));
  };

  const root = getComputedStyle(document.documentElement);
  const samples = {};

  for (const [key, selector] of Object.entries(selectors)) {
    samples[key] = sample(selector, key === 'issueRows' ? 24 : 12);
  }

  const result = {
    capturedAt: new Date().toISOString(),
    url: location.href,
    title: document.title,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    colorScheme: root.colorScheme,
    htmlClass: document.documentElement.className,
    bodyClass: document.body.className,
    rootBackground: root.backgroundColor,
    rootColor: root.color,
    cssVars: getCssVars(),
    topColors: collectColors(),
    samples,
  };

  const json = JSON.stringify(result, null, 2);
  console.log(json);

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(json).catch(() => {});
  }

  return result;
})();
