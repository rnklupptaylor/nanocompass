/* On narrow screens, choose a setting and show its original control beside the result. */
(function(root) {
'use strict';
function bind(app, controls, menu) {
  const narrow = root.matchMedia('(max-width: 900px)');
  const selections = new Map();
  const openedGroups = new Set();
  let settings = [], active, scope;

  function choose(index) {
    active?.classList.remove('compact-selection');
    const setting = settings[index];
    active = setting?.row;
    if (setting) {
      active.classList.add('compact-selection');
      selections.set(scope, setting.key);
    }
  }

  function refresh() {
    app.toggleAttribute('data-has-readouts', Boolean(controls.querySelector('.pv-readouts')));
    if (!narrow.matches) {
      for (const group of openedGroups) group.open = false;
      openedGroups.clear();
      menu.hidden = true;
      app.removeAttribute('data-compact-controls');
      return;
    }

    settings = Array.from(controls.querySelectorAll('.pv-control'), row => {
      const label = row.querySelector('.pv-control-name, .pv-control-head');
      const name = (label?.querySelector('.pv-control-name') || label)?.textContent.trim();
      const group = row.closest('.pv-group');
      const groupName = group?.querySelector('summary').textContent.trim();
      return {row, name, group, groupName, key: groupName ? groupName + ' / ' + name : name};
    }).filter(setting => setting.name);
    scope = app.dataset.lesson + '/' + (app.querySelector('.mg-modes [aria-pressed="true"]')?.dataset.m || '');
    app.toggleAttribute('data-compact-controls', settings.length > 0);
    menu.hidden = settings.length === 0;
    menu.replaceChildren();

    for (const group of openedGroups) {
      if (!controls.contains(group)) openedGroups.delete(group);
    }
    const optionGroups = new Map();
    settings.forEach(({name, group, groupName}, index) => {
      if (group && !group.open) {
        group.open = true;
        openedGroups.add(group);
      }
      if (group && !optionGroups.has(group)) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = groupName;
        optionGroups.set(group, optgroup);
        menu.append(optgroup);
      }
      (optionGroups.get(group) || menu).append(new Option(name, String(index)));
    });
    menu.selectedIndex = Math.max(0, settings.findIndex(setting => setting.key === selections.get(scope)));
    choose(menu.selectedIndex);
  }

  menu.addEventListener('change', () => choose(menu.selectedIndex));
  // Lesson and mode changes replace the controls. Frequent updates inside readouts leave the menu alone.
  new MutationObserver(refresh).observe(controls, {childList: true});
  narrow.addEventListener('change', refresh);
  refresh();
}
root.NanoCompactControls = {bind};
})(typeof globalThis !== 'undefined' ? globalThis : this);
