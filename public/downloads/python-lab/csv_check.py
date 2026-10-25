"""教学 CSV 检查器；AI 辅助草稿，待本人复核。仅使用 Python 标准库。"""
import csv
import io
import math

# 浏览器把输入区作为字符串 input_text 传入；本机从命令行指定文件读取。
if "input_text" not in globals():
    import pathlib
    import sys
    if len(sys.argv) != 2:
        raise SystemExit("用法: python csv_check.py sample.csv")
    input_text = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8-sig")

expected_units = {"E": "N/mm2", "A": "mm2", "L": "mm", "P": "N"}
reader = csv.DictReader(io.StringIO(input_text.lstrip("\ufeff")))
required_columns = {"parameter", "value", "unit"}
missing_columns = required_columns - set(reader.fieldnames or [])
if missing_columns:
    raise ValueError("缺少表头: " + ", ".join(sorted(missing_columns)))

issues = []
seen = set()
row_count = 0
for row in reader:
    row_count += 1
    line = reader.line_num
    parameter = (row.get("parameter") or "").strip()
    text = (row.get("value") or "").strip()
    unit = (row.get("unit") or "").strip()
    if None in row:
        issues.append(f"第 {line} 行: 列数超过表头，请检查分隔符")
    if parameter not in expected_units:
        issues.append(f"第 {line} 行: 未知 parameter={parameter!r}，未自行推断")
    elif parameter in seen:
        issues.append(f"第 {line} 行: 参数 {parameter} 重复")
    seen.add(parameter)
    if not text:
        issues.append(f"第 {line} 行: value 缺失")
    else:
        try:
            value = float(text)
            if not math.isfinite(value):
                raise ValueError("非有限数值")
            if parameter in {"E", "A", "L"} and value <= 0:
                issues.append(f"第 {line} 行: {parameter} 必须大于 0")
        except ValueError:
            issues.append(f"第 {line} 行: value={text!r} 无法解析为有限数值")
    if not unit or (parameter in expected_units and unit != expected_units[parameter]):
        issues.append(f"第 {line} 行: 单位 {unit!r} 不符合本练习约定，不自动换算")

for parameter in sorted(expected_units.keys() - seen):
    issues.append(f"缺少参数: {parameter}")
print(f"读取 {row_count} 行；检查发现 {len(issues)} 项问题。")
for issue in issues:
    print("- " + issue)
if not issues:
    print("本练习字段、数值与单位标记检查通过；这不证明工程模型有效。")

