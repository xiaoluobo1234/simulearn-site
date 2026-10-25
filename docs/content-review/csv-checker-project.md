# 工程参数 CSV 检查器：第一阶段待审核说明

整理日期：2026-10-25（Asia/Shanghai）。内容版本：`csv-checker-v1`；审核条目：`project:csv-checker`。本轮属于教程模块，教学文字、示例规则和使用流程仍待人工审核。自动测试、下载文件或填写审核工作单均不会批准发布。

## 实现范围

项目页 `/learning/projects/csv-checker/` 连接输入约定、四份公开练习文件、既有 Python 实验台和私人学习记录。学习者可以先预测，再显式运行，导出实际结果 JSON，手动登记环境、观察、尚未测试的情况及下一项任务。

`src/lib/csv-project.ts` 只保存公开输入及教学预期。`readCsvProjectCase()` 仅在 URL 含一个 `template=csv` 和一个已知 `case` 时选择固定文件；重复选择、未知案例或其他模板不会选中案例。URL 中的 `code`、`input` 不会变为程序或文件内容。进入页面不会自动加载运行时或执行 Python；既有登录核对、WebWorker 执行和导出流程保持沿用。编辑代码或输入后撤销“原教学样例”标记。

第一阶段仅处理一份固定格式的工程参数 CSV。没有读取有限元云图或任意求解器结果，没有批量处理、自动补值、单位转换、自动修复、AI 工程判断或自动更新学习进度。表头和数值格式通过也不能证明工程模型有效。

## 固定 CSV 契约

- UTF-8，可有一个开头 BOM；第一物理行须为表头。列名恰为 `parameter`、`value`、`unit`，顺序可变；缺少、重复或未知列名均拒绝，不修剪或重命名表头。
- 逗号分隔；引用字段采用双引号，内部双引号写成两个。拒绝未闭合引号、未引用字段中的裸引号，以及闭合引号后的多余字符。数据中的空白物理行忽略，诊断保留原文件物理行号；跨行字段报告开始行。
- 参数只接受 E、A、L、P；约定单位依次为 `N/mm2`、`mm2`、`mm`、`N`。单位是显式字符串标记，不接受自动推测或替换。
- 参数名、数值、单位在检查时去除首尾空白；原始输入保持不变。程序打印表头和前三条原始字符串数据，问题提示保留相关原始值。
- 数值语法接受有符号十进制与科学计数法，如 `100`、`-.5`、`2.1e5`；拒绝 `NaN`、`Infinity`、下划线、附带单位、非 ASCII 数字及转换后非有限的值。实际解析使用 Python `float`，不承诺十进制精确运算。E、A、L 要求大于零，P 可正、负或零。
- 重复或未知参数、缺少参数、列数不符、缺值、数值格式和单位问题逐项输出。程序不判断材料参数、载荷来源、几何假设、稳定性、有限元结果或设计可接受性。

## 四种可观察结果

以下是由固定输入定义的预期，不能抄作学习者实际观察。实际运行记录须保留当次输入、代码、解释器、stdout、stderr 和状态。

| 固定输入 | 预期输出或异常 | 执行状态与数据检查的区别 |
| --- | --- | --- |
| `normal.csv` | 读取 4 行；0 项问题 | 程序正常结束；仅表示本练习规则未发现问题。 |
| `missing-field.csv` | `ValueError: 缺少表头: unit` | 表头契约错误；本机退出非零，浏览器结果为 `error`。 |
| `non-numeric.csv` | 第 3 行 `value='abc'` 无法解析；共 1 项问题 | 程序正常完成，数据仍有问题；本机退出 0，浏览器可为 `succeeded`。 |
| `missing-unit.csv` | 第 2 行单位 `''` 不符合约定；共 1 项问题 | 程序正常完成，数据仍有问题；不推断或补齐单位。 |

本轮的关键教学核对是：程序执行完成、CSV 符合练习规则、用户本机复现、工程有效、个人掌握是不同结论，不能互相推导。

## 证据与审核分别登记

1. **Node 参考执行**：`scripts/check-python-lab.mjs` 在 Node 中加载自托管 Pyodide，实际执行当前 Python 脚本与固定输入。`public/downloads/python-lab/runtime-check.json` 记录真实解释器、执行时间、代码及输入 SHA-256、输出和异常；其中 `csvProjectChecks` 是本项目四例。共享记录另有既有轴杆示例，不把它算作 CSV 检查的工程验证。此记录明示执行者为 Codex AI 执行环境、运行于 Node，不能写成浏览器或用户经历。
2. **浏览器验收**：`tests/e2e/csv-project.spec.ts` 核对公开案例选择、匿名运行限制、编辑后撤销来源标记、精确输入导出和手机布局；`csv-project-real.spec.ts` 使用本地合成登录身份，通过实际 WebWorker 逐例运行并下载结果。合成身份仅服务软件验收，不是真实参与者反馈。浏览器测试是否通过，以本轮实际测试日志和 CI 为准；不能仅因已有测试文件就记为通过。
3. **开发环境本机执行**：本轮在 Codex 执行环境使用 CPython 3.12.14 的实际 CLI 运行四个文件，退出码依次为 `0 / 1 / 0 / 0`。这只验证开发环境中的脚本文件入口，与 Node 参考记录分开，不代表用户本人已经在其环境复现。终端输出编码亦需按实际环境核对。
4. **用户本机执行与学习状态**：仍需用户另行记录实际日期、解释器版本、命令、输入修改、输出和理解；本轮没有取得新的用户运行证据、真实试学反馈或学习效果数据。
5. **人工审核与发布**：审核人需核对契约、四种输出区别、数值边界、资料权限及教学文字，并将实际结论绑定到当前版本和文件指纹。项目已加入现有内容审核集合；文件变化后需重新审核，不将自动测试、哈希相同或旧回执推导为批准发布。

2026-10-25 的本地开发验收已通过全量单元测试 258 项、浏览器测试 163 项、整站构建 56 页及 Functions 编译；浏览器测试包含四种 CSV 在实际 Pyodide WebWorker 中执行并导出不同结果。专项检查另覆盖实际 bundled CPython 的脚本文件入口和相关严格 TypeScript 检查。1440px 浅色与 390px 深色视觉检查未发现横向溢出；项目加载不启动 Python 或写入私人 API。浅色内容区按钮已加深以改善文字对比度。远端 CI 以对应提交的工作流为准；这些开发验收不能代替真实试学反馈、用户本机记录或人工内容审核。

## 下载包生成与字节校验

从仓库根目录依次执行，使用可用的 Node 与 Python 3 解释器：

```sh
node scripts/check-python-lab.mjs
python scripts/package-python-learning.py
npx vitest run tests/csv-project.test.ts tests/csv-project-package.test.ts tests/python-lab.test.ts
```

第一步真实重跑参考程序并重写参考记录。第二步先核对记录中的代码和输入指纹，过期时拒绝打包；随后生成 Python 实验包及 CSV 项目包，逐成员检查 ZIP 内容和 CRC，并生成公开文件 `SHA256SUMS.txt`。打包不执行用户上传内容。

`/downloads/csv-checker/csv-checker.zip` 包含四份 CSV、同一份 `csv_check.py`、README、共享开发参考记录和包内 `PACKAGE-SHA256SUMS.txt`。公开目录的 `SHA256SUMS.txt` 包括 ZIP 自身；包内清单核对解压成员。哈希只表示字节一致，不能证明数据合理、运行身份或人工审核通过。Windows/Linux 的发布字节由仓库属性固定，修改脚本、输入或说明后应按上述顺序重新生成。

PowerShell 可逐项核对下载目录清单，下面命令不修改文件：

```powershell
$csvDownloadRoot = Join-Path (Get-Location) 'public/downloads/csv-checker'
foreach ($csvManifestLine in Get-Content -LiteralPath (Join-Path $csvDownloadRoot 'SHA256SUMS.txt')) {
    $csvManifestParts = $csvManifestLine -split '  ', 2
    $csvActualHash = (Get-FileHash -LiteralPath (Join-Path $csvDownloadRoot $csvManifestParts[1]) -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($csvActualHash -ne $csvManifestParts[0]) { throw ('字节校验失败: ' + $csvManifestParts[1]) }
}
```

单独下载时将脚本与 CSV 放在同一目录，运行 `python csv_check.py normal.csv`；Windows 可用 `py -3`，其他环境可用 `python3`。需要留存用户本机证据时自行保存实际终端输出和环境，不使用包内 AI 参考记录代替。
