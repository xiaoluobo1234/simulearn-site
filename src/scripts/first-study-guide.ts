import { firstStudyGuide, firstStudySteps, type FirstStudyField, type FirstStudyStep } from '../data/first-study-guide';
import { emptyFirstStudy, updateFirstStudy, declareFirstStudy, startFirstStudy, finishFirstStudy, exportFirstStudy, firstStudyMarkdown, addStudyEvidence, removeStudyEvidence, type FirstStudyDraft, type GuideChange } from '../lib/first-study-guide';
import { readFirstStudyBackup } from '../lib/first-study-backup';
import { createStudyEvidence, type StudyEvidence } from '../lib/study-evidence';

const form = document.querySelector<HTMLFormElement>('#first-study-form');
if (form) {
  let draft: FirstStudyDraft = emptyFirstStudy();
  let revision = 0;
  let backupGeneration = 0;
  let evidenceGeneration = 0;
  let backupPreview: { draft: FirstStudyDraft; revision: number } | null = null;
  let evidencePreview: StudyEvidence | null = null;
  const status = document.querySelector<HTMLElement>('#first-study-status');
  const backupStatus = document.querySelector<HTMLElement>('#study-backup-status');
  const evidenceStatus = document.querySelector<HTMLElement>('#study-evidence-status');
  const backupFile = document.querySelector<HTMLInputElement>('#study-backup-file');
  const evidenceFile = document.querySelector<HTMLInputElement>('#study-evidence-file');
  const backupBox = document.querySelector<HTMLElement>('#study-backup-preview');
  const evidenceBox = document.querySelector<HTMLElement>('#study-evidence-preview');
  const backupApply = document.querySelector<HTMLButtonElement>('#study-backup-apply');
  const backupCancel = document.querySelector<HTMLButtonElement>('#study-backup-cancel');
  const evidenceApply = document.querySelector<HTMLButtonElement>('#study-evidence-apply');
  const evidenceCancel = document.querySelector<HTMLButtonElement>('#study-evidence-cancel');
  const report = (text: string) => { if (status) status.textContent = text; };
  const reportBackup = (text: string) => { if (backupStatus) backupStatus.textContent = text; };
  const reportEvidence = (text: string) => { if (evidenceStatus) evidenceStatus.textContent = text; };
  const kindLabel = (kind: StudyEvidence['kind']) => kind === 'python' ? 'Python' : '装配';
  const modelLabel = (match: StudyEvidence['modelMatch']) => ({ 'matches-guide-input': '与本次固定教学输入一致', 'different-input': '与本次固定教学输入不同；请勿混作同一工况', 'not-determined': '无法确定是否使用本次教学输入' }[match]);
  function paragraph(parent: HTMLElement, text: string, className?: string) {
    const node = document.createElement('p'); node.textContent = text;
    if (className) node.className = className;
    parent.append(node); return node;
  }
  function details(parent: HTMLElement, rows: [string, string][]) {
    const list = document.createElement('dl');
    for (const [label, text] of rows) {
      const row = document.createElement('div'); const term = document.createElement('dt'); const value = document.createElement('dd');
      term.textContent = label; value.textContent = text; row.append(term, value); list.append(row);
    }
    parent.append(list);
  }
  function evidenceDetails(parent: HTMLElement, evidence: StudyEvidence) {
    paragraph(parent, `${kindLabel(evidence.kind)} · 未经证实的导入文件`, 'first-trust-label');
    details(parent, [['文件名', evidence.fileName], ['SHA-256（只标识内容）', evidence.sha256], ['字节数', String(evidence.sizeBytes)], ['结果文件原导入时间（本机声明）', evidence.importedAt], ['文件声明的执行状态', evidence.declaredStatus], ['文件声明的执行环境', evidence.declaredEnvironment || '未提供'], ['输入对照', modelLabel(evidence.modelMatch)]]);
    const summary = document.createElement('details'); const title = document.createElement('summary');
    title.textContent = '查看文件声明与输入对照摘要（不证明执行历史）';
    const text = document.createElement('pre'); text.textContent = evidence.summary;
    summary.append(title, text); parent.append(summary);
  }
  function resetBackup(message?: string) {
    backupGeneration++; backupPreview = null;
    if (backupFile) backupFile.value = '';
    if (backupBox) { backupBox.replaceChildren(); backupBox.hidden = true; }
    if (backupApply) backupApply.disabled = true;
    if (backupCancel) backupCancel.disabled = true;
    if (message) reportBackup(message);
  }
  function resetEvidence(message?: string) {
    evidenceGeneration++; evidencePreview = null;
    if (evidenceFile) evidenceFile.value = '';
    if (evidenceBox) { evidenceBox.replaceChildren(); evidenceBox.hidden = true; }
    if (evidenceApply) evidenceApply.disabled = true;
    if (evidenceCancel) evidenceCancel.disabled = true;
    if (message) reportEvidence(message);
  }
  function markChanged() {
    revision++;
    const hadPreviewOrRead = backupPreview !== null || backupCancel?.disabled === false;
    resetBackup(hadPreviewOrRead ? '当前草稿已变化；请重新选择备份并核对预览后再恢复。' : undefined);
  }
  function render() {
    for (const step of firstStudySteps) {
      const checkbox = form!.querySelector<HTMLInputElement>(`[data-guide-check="${step.id}"]`);
      if (checkbox) checkbox.checked = draft.declarations[step.id].selfReported;
      const declaration = form!.querySelector<HTMLElement>(`[data-guide-declared="${step.id}"]`);
      if (declaration) declaration.textContent = draft.declarations[step.id].declaredAt ? `自述确认时间：${draft.declarations[step.id].declaredAt}` : '尚未自行确认';
    }
    const count = firstStudySteps.filter(step => draft.declarations[step.id].selfReported).length;
    const progress = document.querySelector<HTMLElement>('#first-study-count');
    if (progress) progress.textContent = `${count} / ${firstStudySteps.length} 步已自行确认`;
    const times = document.querySelector<HTMLElement>('#first-study-times');
    if (times) times.textContent = `开始：${draft.startedAt || '未记录'} · 结束：${draft.finishedAt || '未记录'}`;
    const start = form!.querySelector<HTMLButtonElement>('#first-study-start');
    if (start) start.disabled = !!draft.startedAt || !!draft.finishedAt;
    const finish = form!.querySelector<HTMLButtonElement>('#first-study-finish');
    if (finish) finish.disabled = !!draft.finishedAt;
    const list = document.querySelector<HTMLElement>('#study-evidence-list');
    if (list) {
      list.replaceChildren();
      if (!draft.evidence.length) paragraph(list, '尚未附结果文件。');
      for (const evidence of draft.evidence) {
        const card = document.createElement('article'); card.dataset.studyEvidence = evidence.kind;
        evidenceDetails(card, evidence);
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'first-button first-button--quiet';
        remove.dataset.removeEvidence = evidence.kind; remove.textContent = `移除${kindLabel(evidence.kind)}文件`;
        remove.addEventListener('click', () => {
          const result = removeStudyEvidence(draft, evidence.kind);
          apply(result, '已移除结果文件，并撤销关联自述与结束标记；观察正文保留，请你重新核对。');
          if (result.ok) resetEvidence('已移除结果文件。可重新选择一份结果并预览。');
        });
        card.append(remove); list.append(card);
      }
    }
    const source = document.querySelector<HTMLElement>('#study-restored-source');
    if (source) {
      source.hidden = !draft.restoredFrom;
      source.textContent = draft.restoredFrom ? `本次恢复来源：${draft.restoredFrom.fileName} · schemaVersion ${draft.restoredFrom.sourceSchemaVersion} · SHA-256 ${draft.restoredFrom.sha256} · 本次本机读入时间 ${draft.restoredFrom.importedAt}。恢复保留原文件中的历史自述时间；散列不证明来源真实性。` : '';
    }
  }
  function apply(change: GuideChange, text: string) {
    if (change.ok) { draft = change.draft; markChanged(); report(text); } else report(change.error);
    render();
  }
  function synchronize(): boolean {
    let valid = true; let changed = false;
    for (const node of form!.querySelectorAll<HTMLTextAreaElement>('[data-guide-field]')) {
      const field = node.dataset.guideField as FirstStudyField;
      const result = updateFirstStudy(draft, field, node.value);
      if (result.ok) { changed ||= draft.fields[field] !== node.value; draft = result.draft; }
      else { report(result.error); valid = false; }
    }
    if (changed) markChanged();
    render(); return valid;
  }
  form.addEventListener('input', event => {
    const node = event.target;
    if (!(node instanceof HTMLTextAreaElement) || !node.dataset.guideField) return;
    apply(updateFirstStudy(draft, node.dataset.guideField as FirstStudyField, node.value), '内容已修改，仅在当前页面内存中；关联声明和结束标记已撤销，请核对后重新确认。');
  });
  form.addEventListener('change', event => {
    const node = event.target;
    if (!(node instanceof HTMLInputElement) || !node.dataset.guideCheck) return;
    const checked = node.checked;
    if (!synchronize()) { render(); return; }
    apply(declareFirstStudy(draft, node.dataset.guideCheck as FirstStudyStep, checked, new Date().toISOString()), checked ? '已记录你的手动自述与本机时间；未核验执行结果。' : '已撤销这一步的自述确认与结束标记。');
  });
  form.querySelector('#first-study-start')?.addEventListener('click', () => apply(startFirstStudy(draft, new Date().toISOString()), '已记录本次显式开始时间；未填写的学习日期与执行环境仍是未知。'));
  form.querySelector('#first-study-finish')?.addEventListener('click', () => {
    if (synchronize()) apply(finishFirstStudy(draft, new Date().toISOString()), '已结束本次自述；这是你的记录声明，不是系统核验通过。请导出保存。');
  });
  form.querySelector('#first-study-clear')?.addEventListener('click', () => {
    draft = emptyFirstStudy(); revision++; form!.reset(); resetBackup('已取消备份读取与恢复预览。'); resetEvidence('已清空已附文件与待附预览。'); render();
    report('已清空本页输入、结果文件、全部手动声明和时间。已下载的文件需你自行管理。');
  });
  backupFile?.addEventListener('change', async () => {
    const file = backupFile.files?.[0]; resetBackup();
    if (!file) { reportBackup('尚未选择备份。'); return; }
    const generation = backupGeneration; const currentRevision = revision;
    if (backupCancel) backupCancel.disabled = false;
    if (file.size > 2 * 1024 * 1024) { reportBackup('试学备份最多 2 MiB；当前草稿保持不变。'); return; }
    reportBackup('正在本机读取并检查备份；尚未恢复。');
    try {
      const result = await readFirstStudyBackup(new Uint8Array(await file.arrayBuffer()), file.name, new Date().toISOString());
      if (generation !== backupGeneration || currentRevision !== revision) return;
      if (!result.ok) { reportBackup(`${result.error} 当前草稿保持不变。`); return; }
      backupPreview = { draft: result.draft, revision };
      if (backupBox) {
        backupBox.replaceChildren(); backupBox.hidden = false;
        const source = result.draft.restoredFrom!;
        paragraph(backupBox, '预览 · 尚未恢复 · 原文件中的自述未经系统核验', 'first-trust-label');
        const nonempty = Object.values(draft.fields).some(text => text.length > 0) || draft.evidence.length > 0 || draft.startedAt || draft.finishedAt;
        paragraph(backupBox, nonempty ? '当前页面已有记录。恢复会替换全部草稿、声明、时间和已附文件；如需保留，请先导出当前 JSON。' : '明确恢复后才会替换本页草稿。');
        details(backupBox, [['来源文件', source.fileName], ['SHA-256（只标识内容）', source.sha256], ['字节数', String(source.sizeBytes)], ['备份格式', `schemaVersion ${source.sourceSchemaVersion}`], ['引导与关联内容版本', `${firstStudyGuide.version} · ${Object.entries(firstStudyGuide.contentVersions).map(([name, version]) => `${name}=${version}`).join(' / ')}`], ['本次本机读入时间', source.importedAt], ['原文件自述开始时间', result.draft.startedAt || '未记录'], ['原文件自述结束时间', result.draft.finishedAt || '未记录'], ['原文件自述确认数', `${firstStudySteps.filter(step => result.draft.declarations[step.id].selfReported).length} / 4`], ['附带结果文件', `${result.draft.evidence.length} 份（仍未经证实）`]]);
        for (const step of firstStudySteps) {
          const preview = document.createElement('details'); const title = document.createElement('summary'); title.textContent = `${step.title} · ${result.draft.declarations[step.id].selfReported ? '原文件已自行确认' : '原文件未确认'}`;
          const text = document.createElement('pre'); text.textContent = result.draft.fields[step.field] || '未记录';
          preview.append(title, text); backupBox.append(preview);
        }
        details(backupBox, [['原文件自述执行环境', result.draft.fields.environment || '未提供']]);
      }
      if (backupApply) backupApply.disabled = false;
      reportBackup('备份检查完成，仅供预览。请核对替换范围后明确恢复；文件声明不证明已运行、复现或掌握。');
    } catch {
      if (generation === backupGeneration) reportBackup('无法读取这份备份；当前草稿保持不变。请选择可读取的 JSON 文件。');
    }
  });
  backupApply?.addEventListener('click', () => {
    if (!synchronize()) return;
    if (!backupPreview || backupPreview.revision !== revision) { resetBackup('草稿已变化，请重新选择备份并核对预览。'); return; }
    draft = backupPreview.draft; revision++;
    for (const field of form!.querySelectorAll<HTMLTextAreaElement>('[data-guide-field]')) field.value = draft.fields[field.dataset.guideField as FirstStudyField];
    resetBackup('已按你的明确操作恢复草稿；历史自述与时间保留，没有新增学习确认。');
    resetEvidence('已恢复备份中的结果文件；仍需核对其原始声明与来源。');
    render(); report('草稿已恢复到当前页面内存。原文件的历史声明与时间未被当作本次点击或已验证学习成果。');
  });
  backupCancel?.addEventListener('click', () => resetBackup('已取消恢复预览；当前草稿保持不变。'));
  evidenceFile?.addEventListener('change', async () => {
    const file = evidenceFile.files?.[0]; resetEvidence();
    if (!file) { reportEvidence('尚未选择结果文件。'); return; }
    const generation = evidenceGeneration;
    if (evidenceCancel) evidenceCancel.disabled = false;
    if (file.size > 256 * 1024) { reportEvidence('每份实验结果最多 256 KiB；当前记录保持不变。'); return; }
    reportEvidence('正在本机读取结果文件；尚未附入，不会执行其中代码。');
    try {
      const result = await createStudyEvidence(new Uint8Array(await file.arrayBuffer()), file.name, new Date().toISOString());
      if (generation !== evidenceGeneration) return;
      if (!result.ok) { reportEvidence(`${result.error} 当前记录保持不变。`); return; }
      evidencePreview = result.value;
      if (evidenceBox) { evidenceBox.replaceChildren(); evidenceBox.hidden = false; evidenceDetails(evidenceBox, result.value); }
      if (evidenceApply) evidenceApply.disabled = false;
      reportEvidence('文件检查完成，仅供预览。执行状态和环境来自文件声明；明确附入后仍不会自动确认学习步骤。');
    } catch {
      if (generation === evidenceGeneration) reportEvidence('无法读取这份结果文件；当前记录保持不变。请选择可读取的 JSON 文件。');
    }
  });
  evidenceApply?.addEventListener('click', () => {
    if (!evidencePreview) return;
    if (!synchronize()) return;
    const result = addStudyEvidence(draft, evidencePreview);
    apply(result, '已附入原始结果文件；关联实验、证据步骤与结束标记已撤销，请核对后自行确认。观察、预测与执行环境没有代填。');
    if (result.ok) resetEvidence('已明确附入结果文件。原始文本只随私人 JSON 导出，不自动上传。');
    else reportEvidence(result.error);
  });
  evidenceCancel?.addEventListener('click', () => resetEvidence('已取消文件预览；已附文件和当前记录保持不变。'));
  function download(format: 'json' | 'md') {
    if (!synchronize()) return;
    const now = new Date().toISOString();
    const text = format === 'json' ? JSON.stringify(exportFirstStudy(draft, now), null, 2) : firstStudyMarkdown(draft, now);
    const url = URL.createObjectURL(new Blob([text], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `simulearn-first-study.${format}`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    report('已导出私人自述草稿；JSON 包含已附文件的原始代码与输入，请核对分享范围。没有上传或同步。');
  }
  form.querySelector('#first-study-export-json')?.addEventListener('click', () => download('json'));
  form.querySelector('#first-study-export-md')?.addEventListener('click', () => download('md'));
  form.addEventListener('submit', event => event.preventDefault());
  // Reset browser-restored controls to match the explicitly empty in-memory state.
  form.reset(); resetBackup(); resetEvidence(); render();
}
