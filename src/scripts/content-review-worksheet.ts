import type { ContentReviewPack } from '../lib/content-review-pack';
import {
  MAX_REVIEW_WORKSHEET_BYTES, emptyReviewWorksheet, editReviewWorksheet, editReviewCheck,
  concludeReviewWorksheet, exportReviewWorksheetJson, reviewWorksheetMarkdown, readReviewWorksheetFile,
  type ReviewWorksheet, type ReviewWorksheetImport, type ReviewConclusion, type Result,
} from '../lib/content-review-worksheet';

const form = document.querySelector<HTMLFormElement>('#review-form');
const data = document.querySelector<HTMLScriptElement>('#review-pack-data');
if (form && data) {
  const pack = JSON.parse(data.textContent || '{}') as ContentReviewPack;
  const queryItems = new URLSearchParams(location.search).getAll('item');
  const requested = queryItems.length === 1 && pack.items.some(item => item.id === queryItems[0]) ? queryItems[0] : 'guide:first-study';
  let sheet = emptyReviewWorksheet(pack, requested);
  let baseline = JSON.stringify(sheet);
  let revision = 0;
  let generation = 0;
  let importedSource: ReviewWorksheetImport['source'] | null = null;
  let preview: { value: ReviewWorksheetImport; revision: number; snapshot: string } | null = null;
  const seenValues = new Map<Element, string>();
  const invalid = new Map<Element, string>();
  const itemChoice = document.querySelector<HTMLSelectElement>('#review-item')!;
  const fileInput = document.querySelector<HTMLInputElement>('#review-import-file')!;
  const previewBox = document.querySelector<HTMLElement>('#review-import-preview')!;
  const importApply = document.querySelector<HTMLButtonElement>('#review-import-apply')!;
  const importCancel = document.querySelector<HTMLButtonElement>('#review-import-cancel')!;
  const status = document.querySelector<HTMLElement>('#review-status')!;
  const importStatus = document.querySelector<HTMLElement>('#review-import-status')!;
  const conclusionChoice = document.querySelector<HTMLSelectElement>('#review-conclusion')!;
  const conclusionLabels: Record<ReviewConclusion, string> = { 'not-recorded': '未登记', acceptable: '本项可接受（填写者声明）', 'changes-required': '需要修改', blocked: '审核受阻' };
  const decisions = [['not-reviewed', '未核对'], ['pass', '已核对通过（填写者声明）'], ['changes-required', '需要修改'], ['not-applicable', '不适用（不能替代通过）']] as const;
  type FieldNode = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const fieldNodes = () => Array.from(form!.querySelectorAll<FieldNode>('[data-review-field], [data-review-check-field]'));
  const snapshot = () => JSON.stringify(fieldNodes().map(node => [node.id, node.value]));
  const dirty = () => invalid.size > 0 || JSON.stringify(sheet) !== baseline;
  const report = (text: string) => { status.textContent = text; };
  function paragraph(parent: HTMLElement, text: string, className?: string) {
    const node = document.createElement('p'); node.textContent = text;
    if (className) node.className = className; parent.append(node); return node;
  }
  function metadata(parent: HTMLElement, rows: [string, string][]) {
    parent.replaceChildren();
    for (const [term, value] of rows) {
      const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = term; dd.textContent = value; row.append(dt, dd); parent.append(row);
    }
  }
  function cancelImport(message?: string) {
    generation++; preview = null; fileInput.value = ''; previewBox.replaceChildren(); previewBox.hidden = true;
    importApply.disabled = true; importCancel.disabled = true;
    if (message) importStatus.textContent = message;
  }
  function markChanged() {
    revision++;
    const pending = !importCancel.disabled;
    cancelImport(pending ? '编辑内容已变化，请重新选择回执并核对预览。当前内容保持不变。' : undefined);
  }
  function renderConclusion() {
    conclusionChoice.value = sheet.review.conclusion;
    document.querySelector<HTMLElement>('#review-conclusion-state')!.textContent = `本项结论：${conclusionLabels[sheet.review.conclusion]}。发布仍待仓库评审。`;
  }
  function renderBasis() {
    const current = pack.items.find(item => item.id === sheet.item.id)!;
    document.querySelector<HTMLElement>('#review-item-title')!.textContent = sheet.item.title;
    metadata(document.querySelector<HTMLElement>('#review-item-meta')!, [['条目', sheet.item.id], ['内容版本', sheet.item.contentVersion], ['文件集合 SHA-256', sheet.item.fingerprint]]);
    metadata(document.querySelector<HTMLElement>('#review-basis-current')!, [['源码提交', pack.sourceCommit], ['生成时间', pack.generatedAt], ['工作树', pack.workingTree]]);
    metadata(document.querySelector<HTMLElement>('#review-basis-original')!, [['原源码提交', sheet.basis.sourceCommit], ['原生成时间', sheet.basis.generatedAt], ['原工作树', sheet.basis.workingTree]]);
    const link = document.querySelector<HTMLAnchorElement>('#review-content-link')!;
    link.href = current.href;
    const list = document.querySelector<HTMLElement>('#review-files')!; list.replaceChildren();
    for (const file of current.files) {
      const row = document.createElement('div'); row.className = 'worksheet-file-row';
      const path = document.createElement('strong'); path.textContent = file.path;
      const sha = document.createElement('code'); sha.textContent = file.sha256;
      const size = document.createElement('span'); size.textContent = `${file.sizeBytes.toLocaleString('en-US')} 字节 · ${file.matchesCommit ? '当前字节与本次源码提交一致' : '当前字节无对应提交链接'}`;
      row.append(path, sha, size);
      const expectedUrl = `${pack.repository}/blob/${pack.sourceCommit}/${file.path.split('/').map(encodeURIComponent).join('/')}`;
      if (file.matchesCommit && file.sha256 === file.committedSha256 && file.commitUrl === expectedUrl) {
        const source = document.createElement('a'); source.href = expectedUrl; source.textContent = '查看对应提交 ↗'; source.target = '_blank'; source.rel = 'noopener noreferrer'; row.append(source);
      }
      list.append(row);
    }
    const source = document.querySelector<HTMLElement>('#review-restored-source')!;
    source.hidden = !importedSource;
    source.textContent = importedSource ? `本次恢复文件：${importedSource.fileName} · SHA-256 ${importedSource.sha256} · ${importedSource.sizeBytes} 字节 · 本次本机读入时间 ${importedSource.importedAt}。原审核姓名、日期与结论未改写，仍是文件声明。` : '';
  }
  function renderForm() {
    seenValues.clear(); invalid.clear(); itemChoice.value = sheet.item.id;
    for (const node of form!.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('[data-review-field]')) {
      const key = node.dataset.reviewField as 'reviewer' | 'reviewedAt' | 'scope' | 'notes';
      node.value = sheet.review[key]; node.removeAttribute('aria-invalid');
    }
    const checks = document.querySelector<HTMLElement>('#review-checks')!; checks.replaceChildren();
    for (const [index, check] of sheet.item.checks.entries()) {
      const fieldset = document.createElement('fieldset'); const legend = document.createElement('legend'); legend.textContent = `${index + 1}. ${check.question}`; fieldset.append(legend);
      const decisionLabel = document.createElement('label'); decisionLabel.textContent = '实际检查结论';
      const decision = document.createElement('select'); decision.id = `review-check-${check.id}-decision`; decision.dataset.reviewCheck = check.id; decision.dataset.reviewCheckField = 'decision';
      for (const [value, title] of decisions) { const option = document.createElement('option'); option.value = value; option.textContent = title; decision.append(option); }
      decision.value = sheet.review.checks[index].decision; decisionLabel.htmlFor = decision.id; decisionLabel.append(decision);
      const noteLabel = document.createElement('label'); noteLabel.textContent = '实际核对依据、问题或不适用理由';
      const note = document.createElement('textarea'); note.rows = 3; note.maxLength = 10000; note.id = `review-check-${check.id}-note`; note.dataset.reviewCheck = check.id; note.dataset.reviewCheckField = 'note';
      note.value = sheet.review.checks[index].note; note.placeholder = '记录具体章节、文件、输入、核对结果与尚未验证的范围'; noteLabel.htmlFor = note.id; noteLabel.append(note);
      fieldset.append(decisionLabel, noteLabel); checks.append(fieldset);
    }
    for (const node of fieldNodes()) seenValues.set(node, node.value);
    renderConclusion(); renderBasis();
  }
  function acceptEdit(node: FieldNode): boolean {
    // Browser textarea values normalize line endings; retain imported raw text until this field actually changes.
    if (seenValues.get(node) === node.value) return !invalid.has(node);
    seenValues.set(node, node.value); markChanged();
    let result: Result<ReviewWorksheet>;
    if (node.dataset.reviewField) result = editReviewWorksheet(sheet, node.dataset.reviewField as 'reviewer' | 'reviewedAt' | 'scope' | 'notes', node.value);
    else result = editReviewCheck(sheet, node.dataset.reviewCheck!, node.dataset.reviewCheckField as 'decision' | 'note', node.value);
    if (!result.ok) {
      invalid.set(node, result.error); node.setAttribute('aria-invalid', 'true');
      const cleared = concludeReviewWorksheet(sheet, 'not-recorded');
      if (cleared.ok) sheet = cleared.value;
      renderConclusion();
      report(`${result.error} 请修正当前输入后再导出、登记结论或恢复回执。`); return false;
    }
    sheet = result.value; invalid.delete(node); node.removeAttribute('aria-invalid'); renderConclusion();
    report('内容已修改，仅在当前页面内存中。原结论已撤销，请重新核对后登记；离开前请导出。'); return true;
  }
  function synchronize(): boolean {
    for (const node of fieldNodes()) acceptEdit(node);
    if (invalid.size) { report(`${invalid.values().next().value} 当前有未保存的无效输入，请修正后再继续。`); return false; }
    return true;
  }
  function confirmDiscard(title: string): boolean {
    return !dirty() || window.confirm(`${title}会丢弃当前“${sheet.item.title}”中尚未导出的填写内容、检查依据与结论。需要保留时请先取消并导出 JSON。仍要继续吗？`);
  }
  form.addEventListener('input', event => { const node = event.target; if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) if (node.dataset.reviewField || node.dataset.reviewCheckField) acceptEdit(node); });
  form.addEventListener('change', event => { const node = event.target; if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement || node instanceof HTMLSelectElement) if (node.dataset.reviewField || node.dataset.reviewCheckField) acceptEdit(node); });
  form.addEventListener('submit', event => event.preventDefault());
  itemChoice.addEventListener('change', () => {
    synchronize(); const next = itemChoice.value;
    if (!pack.items.some(item => item.id === next)) { itemChoice.value = sheet.item.id; return; }
    if (next === sheet.item.id) return;
    if (!confirmDiscard('切换审核条目')) { itemChoice.value = sheet.item.id; return; }
    sheet = emptyReviewWorksheet(pack, next); importedSource = null; baseline = JSON.stringify(sheet); revision++;
    cancelImport('已切换内容，取消所有待恢复文件。'); renderForm(); report('已开始新的空白单项回执。审核人、日期、检查与结论均未填写。');
  });
  document.querySelector('#review-new')?.addEventListener('click', () => {
    synchronize(); if (!confirmDiscard('重新填写本项')) return;
    sheet = emptyReviewWorksheet(pack, sheet.item.id); importedSource = null; baseline = JSON.stringify(sheet); revision++;
    cancelImport('已重新填写，取消所有待恢复文件。'); renderForm(); report('已清空本项记录。已下载的文件需你自行管理。');
  });
  document.querySelector('#review-conclude')?.addEventListener('click', () => {
    const selected = conclusionChoice.value as ReviewConclusion;
    if (!synchronize()) return;
    const result = concludeReviewWorksheet(sheet, selected);
    if (!result.ok) { report(result.error); return; }
    if (JSON.stringify(result.value) !== JSON.stringify(sheet)) markChanged();
    sheet = result.value; renderConclusion(); report(`已记录你手动选择的“${conclusionLabels[sheet.review.conclusion]}”。这是本机回执，发布仍待仓库评审。请导出保存。`);
  });
  function exportFile(format: 'json' | 'md') {
    if (!synchronize()) return;
    try {
      const now = new Date().toISOString();
      const text = format === 'json' ? exportReviewWorksheetJson(sheet, now) : reviewWorksheetMarkdown(sheet, now);
      const blob = new Blob([text], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `simulearn-review-${sheet.item.id.replace(/:/g, '-')}.${format}`; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000); baseline = JSON.stringify(sheet);
      report(`已导出${format === 'json' ? ' JSON 备份' : ' Markdown 回执'}。请确认下载文件已保存；未上传记录，未批准发布。`);
    } catch (error) { report(error instanceof Error ? error.message : '无法导出当前记录。'); }
  }
  document.querySelector('#review-export-json')?.addEventListener('click', () => exportFile('json'));
  document.querySelector('#review-export-md')?.addEventListener('click', () => exportFile('md'));
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]; cancelImport();
    if (!file) { importStatus.textContent = '尚未选择文件。'; return; }
    if (!synchronize()) { importStatus.textContent = '当前输入无效，请先修正再选择回执；编辑内容保持不变。'; return; }
    const ownGeneration = generation, ownRevision = revision, ownSnapshot = snapshot();
    importCancel.disabled = false;
    if (file.size > MAX_REVIEW_WORKSHEET_BYTES) { importStatus.textContent = '审核回执最多 2 MiB；当前编辑内容保持不变。'; return; }
    importStatus.textContent = '正在本机读取与比较版本；尚未恢复。';
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const result = await readReviewWorksheetFile(bytes, file.name, new Date().toISOString(), pack);
      if (ownGeneration !== generation || ownRevision !== revision) return;
      if (ownSnapshot !== snapshot()) { cancelImport('编辑内容已变化，请重新选择回执并核对预览。当前内容保持不变。'); return; }
      if (!result.ok) { importStatus.textContent = `${result.error} 当前编辑内容保持不变。`; return; }
      preview = { value: result.value, revision, snapshot: ownSnapshot };
      renderPreview(result.value); importApply.disabled = !result.value.match.compatible;
      importStatus.textContent = result.value.match.compatible ? '内容、文件与检查问题均匹配当前目录。请核对原文，再明确恢复；尚未修改编辑内容。' : '这份回执与当前内容不匹配，仅供查看。已停止恢复，当前编辑内容保持不变。';
    } catch {
      if (ownGeneration === generation && ownRevision === revision && ownSnapshot === snapshot()) importStatus.textContent = '无法读取这份回执；当前编辑内容保持不变。';
    }
  });
  function renderPreview(value: ReviewWorksheetImport) {
    previewBox.replaceChildren(); previewBox.hidden = false;
    paragraph(previewBox, value.match.compatible ? '版本对照：与当前内容一致 · 尚未恢复' : '版本对照：不一致 · 不能恢复', 'worksheet-match');
    const source = document.createElement('dl'); source.className = 'worksheet-metadata'; previewBox.append(source);
    metadata(source, [['文件名', value.source.fileName], ['SHA-256', value.source.sha256], ['字节数', String(value.source.sizeBytes)], ['本次本机读入时间', value.source.importedAt], ['原审核条目', `${value.worksheet.item.title} · ${value.worksheet.item.id}`], ['原内容版本', value.worksheet.item.contentVersion], ['原文件集合指纹', value.worksheet.item.fingerprint], ['原依据提交', value.worksheet.basis.sourceCommit], ['当前构建提交', pack.sourceCommit], ['原审核人（文件声明）', value.worksheet.review.reviewer || '未填写'], ['原审核日期（文件声明）', value.worksheet.review.reviewedAt || '未填写'], ['原结论（文件声明）', conclusionLabels[value.worksheet.review.conclusion]]]);
    if (value.match.reasons.length) { const reasons = document.createElement('ul'); for (const text of value.match.reasons) { const item = document.createElement('li'); item.textContent = text; reasons.append(item); } previewBox.append(reasons); }
    const full = document.createElement('details'), title = document.createElement('summary'), body = document.createElement('pre');
    title.textContent = '查看完整原审核记录与文件依据（仅作文本展示）'; body.textContent = JSON.stringify(value.worksheet, null, 2); full.append(title, body); previewBox.append(full);
    paragraph(previewBox, dirty() ? '恢复将替换当前尚未导出的编辑内容。需要保留时请先导出 JSON。' : '明确恢复后才会替换编辑内容。原文件中的身份、日期和结论不会被当作系统核验。');
  }
  importCancel.addEventListener('click', () => cancelImport('已取消读取和预览；当前编辑内容保持不变。'));
  importApply.addEventListener('click', () => {
    if (!synchronize()) return;
    if (!preview || !preview.value.match.compatible || preview.revision !== revision || preview.snapshot !== snapshot()) { cancelImport('编辑内容或预览已变化，请重新选择文件。'); return; }
    if (!confirmDiscard('恢复审核回执')) return;
    sheet = preview.value.worksheet; importedSource = preview.value.source; baseline = JSON.stringify(sheet); revision++;
    cancelImport('已按你的明确操作恢复回执。保留原文、原审核依据和文件声明；未上传或批准发布。'); renderForm();
    report('已恢复本机回执。原字段未被重新填写，未编辑的换行格式也保留在 JSON；后续修改会撤销原结论。');
  });
  window.addEventListener('beforeunload', event => { synchronize(); if (dirty()) { event.preventDefault(); event.returnValue = ''; } });
  renderForm();
}
