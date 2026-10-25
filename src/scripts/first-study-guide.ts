import { firstStudySteps, type FirstStudyField, type FirstStudyStep } from '../data/first-study-guide';
import { emptyFirstStudy, updateFirstStudy, declareFirstStudy, startFirstStudy, finishFirstStudy, exportFirstStudy, firstStudyMarkdown, type FirstStudyDraft, type GuideChange } from '../lib/first-study-guide';

const form = document.querySelector<HTMLFormElement>('#first-study-form');
if (form) {
  let draft: FirstStudyDraft = emptyFirstStudy();
  const status = document.querySelector<HTMLElement>('#first-study-status');
  const report = (text: string) => { if (status) status.textContent = text; };
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
  }
  function apply(change: GuideChange, text: string) {
    if (change.ok) { draft = change.draft; report(text); } else report(change.error);
    render();
  }
  function synchronize(): boolean {
    let valid = true;
    for (const node of form!.querySelectorAll<HTMLTextAreaElement>('[data-guide-field]')) {
      const result = updateFirstStudy(draft, node.dataset.guideField as FirstStudyField, node.value);
      if (result.ok) draft = result.draft; else { report(result.error); valid = false; }
    }
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
    draft = emptyFirstStudy(); form.reset(); render(); report('已清空本页输入、全部手动声明和时间。已下载的文件需你自行管理。');
  });
  function download(format: 'json' | 'md') {
    if (!synchronize()) return;
    const now = new Date().toISOString();
    const text = format === 'json' ? JSON.stringify(exportFirstStudy(draft, now), null, 2) : firstStudyMarkdown(draft, now);
    const url = URL.createObjectURL(new Blob([text], { type: format === 'json' ? 'application/json;charset=utf-8' : 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `simulearn-first-study.${format}`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    report('已导出私人自述草稿；请核对实际运行证据与分享范围。没有上传或同步。');
  }
  form.querySelector('#first-study-export-json')?.addEventListener('click', () => download('json'));
  form.querySelector('#first-study-export-md')?.addEventListener('click', () => download('md'));
  form.addEventListener('submit', event => event.preventDefault());
  // Reset browser-restored controls to match the explicitly empty in-memory state.
  form.reset(); render();
}
