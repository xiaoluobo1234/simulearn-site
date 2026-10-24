const hub = document.querySelector<HTMLElement>('[data-diagnostic-hub]');
if (hub) {
  const form = hub.querySelector<HTMLFormElement>('form')!;
  const query = hub.querySelector<HTMLInputElement>('#diagnostic-query')!;
  const stage = hub.querySelector<HTMLSelectElement>('#diagnostic-stage')!;
  const cards = Array.from(hub.querySelectorAll<HTMLElement>('[data-diagnostic-card]'));
  const normalize = (value: string) => value.normalize('NFKC').toLocaleLowerCase().trim();
  let composing = false;
  function apply(updateURL = false) {
    const terms = normalize(query.value.slice(0,120)).split(/\s+/).filter(Boolean);
    let count = 0;
    for (const card of cards) {
      const match = (!stage.value || card.dataset.stage === stage.value) && terms.every(term => normalize(card.dataset.search || '').includes(term));
      card.hidden = !match; if (match) count++;
    }
    hub!.querySelector('#diagnostic-count')!.textContent = `共 ${count} 条排查路径`;
    (hub!.querySelector('#diagnostic-empty') as HTMLElement).hidden = count > 0;
    if (updateURL) {
      const url = new URL(location.href); url.searchParams.delete('q'); url.searchParams.delete('stage');
      if(query.value.trim()) url.searchParams.set('q',query.value.trim().slice(0,120));
      if(stage.value) url.searchParams.set('stage',stage.value);
      history.replaceState(null,'',url);
    }
  }
  function restore() {
    const params = new URLSearchParams(location.search); query.value = (params.get('q') || '').slice(0,120);
    const value = params.get('stage') || ''; stage.value = Array.from(stage.options).some(option => option.value === value) ? value : '';
    const target = location.hash ? document.getElementById(location.hash.slice(1)) : null;
    if (target?.matches('[data-diagnostic-card]')) { query.value = ''; stage.value = ''; }
    apply();
    if(target) requestAnimationFrame(()=>target.scrollIntoView());
  }
  form.addEventListener('submit',event=>{event.preventDefault(); if(!composing) apply(true);});
  query.addEventListener('compositionstart',()=>composing=true);
  query.addEventListener('compositionend',()=>{composing=false;apply(true);});
  query.addEventListener('input',()=>{if(!composing)apply(true);});
  stage.addEventListener('change',()=>apply(true));
  hub.querySelector('#diagnostic-reset')!.addEventListener('click',()=>{query.value='';stage.value='';apply(true);query.focus();});
  window.addEventListener('popstate',restore); window.addEventListener('hashchange',restore); restore();
}
