# 工程参数 CSV 检查器 · 第一阶段练习输入

版本：csv-checker-v1。AI 辅助教学草稿，待人工复核。以下均是合成练习文件与预期，不代表作者、学习者已经运行或掌握。

页面入口：`/learning/projects/csv-checker/`。浏览器入口：`/labs/python/?template=csv&case=normal`。四个 `case` 只能选择本站固定公开文件；URL 中的 `input` 或 `code` 不会成为程序或输入。

## 输入约定

UTF-8 CSV，可以带一个 UTF-8 BOM。第一行须是表头，三个列名必须恰为 `parameter`、`value`、`unit`，顺序可以改变；重复、未知、缺少的列名均拒绝。表头不自动修剪或重命名。逗号分隔，使用标准双引号转义；字段中出现双引号时必须引用整个字段，内部双引号写成两个。引号闭合后只能是逗号、换行或文件结束，不接受畸形引号。数据中的空白物理行忽略，问题位置沿用原文件的物理行号；跨行字段报告其开始行。

四个参数与单位标记固定为 E=`N/mm2`、A=`mm2`、L=`mm`、P=`N`。参数名、数值和单位在检查时去除首尾空白，但原始字符串会保留在前三条数据预览及问题提示中。数值只接受十进制或科学计数法，例如 `100`、`-1.5`、`.5`、`2.1e5`；拒绝 `NaN`、`Infinity`、下划线、逗号千位符或附带单位的数字。E/A/L 必须大于零；P 可正、负或零。程序不换算单位，不补值，不判断材料、有限元模型或设计是否有效。

## 本机运行

解压 `/downloads/csv-checker/csv-checker.zip`，或另下载 `/downloads/python-lab/csv_check.py` 并与这四份 CSV 放在同一目录。在终端运行：

```sh
python --version
python csv_check.py normal.csv
python csv_check.py missing-field.csv
python csv_check.py non-numeric.csv
python csv_check.py missing-unit.csv
```

Windows 可用 `py -3`，macOS/Linux 可用 `python3`。脚本仅使用 Python 标准库，不修改输入。程序打印原始表头、前三条原始数据及问题汇总；原始字符串显示为 `'100'` 并不表示它已经是数值。

| 文件 | 可观察的预期，不是已运行记录 |
| --- | --- |
| normal.csv | 读取 4 行，0 项问题；本机退出 0 / 浏览器 succeeded。 |
| missing-field.csv | `ValueError: 缺少表头: unit`；本机退出非零 / 浏览器 error。 |
| non-numeric.csv | 第 3 行 A 的 `value='abc'` 无法解析；读取 4 行、1 项问题。 |
| missing-unit.csv | 第 2 行 E 的单位 `''` 不符合约定；读取 4 行、1 项问题。 |

逐行数据问题会列出后正常结束，所以后两例的本机退出码仍为 0、浏览器仍可能显示 succeeded。此状态只说明检查程序完成，不能当作 CSV 合格。表头、CSV 引号格式或文件读取错误会抛异常并退出非零。请核对实际 stdout/stderr，另行记录运行日期、解释器、输入版本和自己的观察；不自动推导学习完成。

这四份文件只覆盖第一阶段的指定情况，不是完整验证集，也不含真实客户或工程数据。

练习包中的 `runtime-check.json` 是 Codex AI 执行环境实际运行固定代码与输入的参考记录，不是学习者或作者的经历。包内 `PACKAGE-SHA256SUMS.txt` 与公开目录的 `SHA256SUMS.txt` 只校验文件字节，不能证明工程有效或人工审核通过。
