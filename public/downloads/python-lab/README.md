# SimuLearn · Python 小实验包

AI 辅助编写的教学草稿，待本人复核。本包不代表作者或任何学习者已经运行、掌握或完成 CAE 验证。页面入口：`/labs/python/`。

## 本机运行（Python 3 标准库，无需 pip）

解压到一个可写目录，在该目录打开终端：

```sh
python --version
python csv_check.py sample.csv
python axial_bar.py bar-input.json
```

Windows 若 `python` 不可用，可将命令改为 `py -3`；macOS/Linux 可能使用 `python3`。程序只读指定文件并把实际输出写到终端，不覆盖输入或自动生成结果文件。需要留证据时手动重定向，例如：

```sh
python csv_check.py sample.csv > my-csv-output.txt 2>&1
python axial_bar.py bar-input.json > my-bar-output.txt 2>&1
```

请另行记录你实际使用的解释器版本、日期、修改与输出。`runtime-check.json` 是开发过程中的 AI 执行环境参考记录，与用户本机执行、浏览器执行、CAE 求解分别管理。

## CSV 练习

固定列仅为 `parameter,value,unit`（列顺序可调整；重复、缺少或额外表头会拒绝）；四个参数 E/A/L/P。支持的单位标记分别为 `N/mm2`、`mm2`、`mm`、`N`。不做单位猜测或自动换算。检查缺表头、缺值、非有限数字、重复或未知参数、不符单位；E/A/L 要求正数，P 可正、负或零。已知输入预期读取 4 行且无格式问题；这不证明材料、结构或工程模型有效。

程序先打印表头及前 3 条原始字符串记录，再输出检查日志。有限十进制数可使用科学计数，不接受数字下划线、NaN、Infinity 或把单位写入数值栏；仅比较本练习的单位标记清单，不自动换算，也不据此认定其他物理单位必然不兼容。

四种固定输入及任务指引见 `/learning/projects/csv-checker/`，或下载 `/downloads/csv-checker/csv-checker.zip`。将 A 的数值改为 `abc`，应看到对应 CSV 行与无法解析提示。删除 P 行，应提示缺少参数。普通行问题会全部列出，退出码仍为 0（表示检查程序完成，不表示数据合格）；无法解析表头、读文件或 JSON 时会抛异常，退出非零。

## 轴杆练习

这只是 `u=P*L/(E*A)`、`R=-P`、`U=P*u/2` 的教学算术，不组装刚度矩阵、不调用有限元软件。一维均匀直杆、线弹性、小变形、无分布载荷、左端位移零、右端轴向端力；向右为正，R 是左端支承对杆的反力。E=210000 N/mm²、A=100 mm²、L=1000 mm、P=+10000 N。

参考计算值：u=0.476190476 mm，R=-10000 N，U=2380.952381 N·mm=2.380952381 J。改变 P 为负时 u 和 R 反号，U 仍非负；P=0 时三者为零。没有检查屈服、压杆稳定、应力集中、实际连接或三维效应。与参考值相符不能代替工程验收。

基础公式来源为 MIT OpenCourseWare Roylance《Finite Element Analysis》（https://ocw.mit.edu/courses/3-11-mechanics-of-materials-fall-1999/812a432c72099369788f78fb344eb047_MIT3_11F99_fea.pdf），沿用项目此前实际核对的杆单元推导范围第 3–6 页；此处仅复用基础杆件关系，不声称重新通读全文。站内进一步推导：`/domains/structural/kp/shape-functions/`、`/domains/structural/kp/element-stiffness/`。

## 浏览器运行与边界

浏览器编辑器展示的就是这两个 `.py` 文件；输入区通过独立字符串 `input_text` 传给 Python，不拼接成代码。本站页面先核对登录，之后才按用户点击建立 WebWorker、从本站加载固定 Pyodide 314.0.7（CPython 3.14.2 / WebAssembly）。首次必要文件共约 13.5 MB（十进制）；未包含 NumPy/pandas，不自动下载安装任何包。

一次显式运行创建一个新 Worker；运行环境就绪后代码执行限时 8 秒，运行环境加载限时 45 秒。停止/超时会直接终止 Worker，下一次创建新环境。标准输出和错误在页面分别显示，输出保留约 32,000 字符，过量输出会停止。`input()` 交互不可用，请使用输入文本区。运行结果 JSON 只含该次代码/输入快照、实际环境、输出、状态及实际时间，不自动推导“已复现/已掌握”。

页面控制器不保存代码/输入到 localStorage、账户、服务器或 AI；刷新/关闭会丢失编辑，需手动导出。浏览器仍会请求本站账户状态与运行文件，并可能缓存运行文件。Python 默认不获得 JS 全局对象，启动后禁用常见 fetch/XHR/WebSocket/子 Worker 接口；这并非恶意代码安全沙箱，不应运行不可信代码或填入密钥、个人信息及未授权工程资料。无需浏览器提供任何本机文件权限。

本机脚本不使用浏览器的运行时间/输出限制，在本机运行修改后的代码前应自行阅读。无网时可使用预先下载的此包；页面首次运行仍需要成功加载本站运行文件。首次下载离线包也需要网络。

## 依赖来源与实际核对范围

- Pyodide 固定 npm 包： https://registry.npmjs.org/pyodide/-/pyodide-314.0.7.tgz 。自托管核心原文件与 MPL-2.0、CPython、Emscripten 许可在 `/vendor/pyodide/314.0.7/`；来源与上游完整性在其中 `SOURCE.json`，原字节 SHA256 在其中 `SHA256SUMS.txt`。未改动上游运行代码。
- 实际读取官方 https://pyodide.org/en/stable/usage/webworker.html 的 module Worker 示例与独立线程说明、`downloading-and-deploying.html` 的最小五文件清单、`streams.html` 的 stdin/标准输出 write handler、`usage/api/js-api.html` 的 loadPyodide/indexURL/jsglobals/runPythonAsync 接口。查阅时 stable 为 314.0.7；未声称核对全部文档或所有第三方包。
- 本包 `SHA256SUMS.txt` 校验除自身外的每个单独文件及 ZIP；ZIP 内容是两份 Python、两份输入、本说明、真实开发参考执行记录与包内 `PACKAGE-SHA256SUMS.txt`。校验哈希只证明文件一致，不证明工程模型正确。

开发验证结果只引用实际生成的 `runtime-check.json`。浏览器验收由项目统一运行，未在本说明提前声明通过；你在用户本机的实际复现仍待执行与核对。

仓库维护者修改模板或输入后，可在仓库根目录显式运行 `node scripts/check-python-lab.mjs`，再运行 `python scripts/package-python-learning.py`（或 Python 3 对应命令）。前者实际执行固定运行时，后者核对参考记录绑定后重新生成两套练习包；这些命令不会执行用户文件或确认教学审核。
