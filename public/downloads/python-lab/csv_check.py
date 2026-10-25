"""教学 CSV 检查器；AI 辅助草稿，待本人复核。仅使用 Python 标准库。"""
import csv
import io
import math
import re

# 浏览器把输入区作为字符串 input_text 传入；本机从命令行指定文件读取。
if "input_text" not in globals():
    import pathlib
    import sys
    if len(sys.argv) != 2:
        raise SystemExit("用法: python csv_check.py sample.csv")
    input_text = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8-sig")

expected_units = {"E": "N/mm2", "A": "mm2", "L": "mm", "P": "N"}
required_columns = {"parameter", "value", "unit"}
# float() alone also accepts NaN, Infinity and underscores: this exercise does not.
decimal_number = re.compile(r"[+-]?(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?\Z")


def check_csv_quotes(source):
    """Reject bare quotes too: csv.reader(strict=True) alone allows those."""
    state = "start"
    physical_line = 1
    previous = ""
    for character in source:
        if state == "quoted":
            if character == '"':
                state = "closed"
        elif state == "closed":
            if character == '"':
                state = "quoted"  # Escaped double quote inside the field.
            elif character == "," or character in "\r\n":
                state = "start"
            else:
                raise ValueError(f"CSV 格式错误，第 {physical_line} 行: 闭合引号后有多余字符")
        elif character == '"':
            if state != "start":
                raise ValueError(f"CSV 格式错误，第 {physical_line} 行: 双引号必须在字段开头")
            state = "quoted"
        elif character == "," or character in "\r\n":
            state = "start"
        else:
            state = "unquoted"
        if character == "\r" or (character == "\n" and previous != "\r"):
            physical_line += 1
        previous = character
    if state == "quoted":
        raise ValueError(f"CSV 格式错误，第 {physical_line} 行: 双引号未闭合")


source = input_text[1:] if input_text.startswith("\ufeff") else input_text
check_csv_quotes(source)
reader = csv.reader(io.StringIO(source, newline=""), strict=True)
fieldnames = next(reader, [])
missing_columns = required_columns - set(fieldnames)
if missing_columns:
    raise ValueError("缺少表头: " + ", ".join(sorted(missing_columns)))
duplicate_columns = {name for name in fieldnames if fieldnames.count(name) > 1}
if duplicate_columns:
    raise ValueError("表头重复: " + ", ".join(sorted(duplicate_columns)))
unknown_columns = set(fieldnames) - required_columns
if unknown_columns:
    raise ValueError("未知表头: " + ", ".join(sorted(unknown_columns)))

print(f"表头（原始字符串）: {fieldnames!r}")
print("前三条数据（原始字符串，不等于数值）:")

issues = []
seen = set()
row_count = 0
while True:
    line = reader.line_num + 1  # Start physical line, including multiline fields.
    try:
        fields = next(reader)
    except StopIteration:
        break
    if not fields:  # Ignore empty physical lines without renumbering later rows.
        continue
    row_count += 1
    row = dict(zip(fieldnames, fields))
    if row_count <= 3:
        print(f"第 {line} 行: {fields!r}")
    original_parameter = row.get("parameter") or ""
    parameter = original_parameter.strip()
    original_value = row.get("value") or ""
    text = original_value.strip()
    original_unit = row.get("unit") or ""
    unit = original_unit.strip()
    if len(fields) != len(fieldnames):
        issues.append(f"第 {line} 行: 列数 {len(fields)} 与表头 {len(fieldnames)} 不一致，请检查分隔符")
    if parameter not in expected_units:
        issues.append(f"第 {line} 行: 未知 parameter={original_parameter!r}，未自行推断")
    elif parameter in seen:
        issues.append(f"第 {line} 行: 参数 {parameter} 重复")
    seen.add(parameter)
    if not text:
        issues.append(f"第 {line} 行: value 缺失")
    else:
        try:
            if not decimal_number.fullmatch(text):
                raise ValueError("非十进制或科学计数法")
            value = float(text)
            if not math.isfinite(value):
                raise ValueError("非有限数值")
            if parameter in {"E", "A", "L"} and value <= 0:
                issues.append(f"第 {line} 行: {parameter} 必须大于 0")
        except ValueError:
            issues.append(f"第 {line} 行: value={original_value!r} 无法解析为有限数值")
    if not unit or (parameter in expected_units and unit != expected_units[parameter]):
        issues.append(f"第 {line} 行: 单位 {original_unit!r} 不符合本练习约定，不自动换算")

for parameter in sorted(expected_units.keys() - seen):
    issues.append(f"缺少参数: {parameter}")
print(f"读取 {row_count} 行；检查发现 {len(issues)} 项问题。")
for issue in issues:
    print("- " + issue)
if not issues:
    print("本练习字段、数值与单位标记检查通过；这不证明工程模型有效。")

