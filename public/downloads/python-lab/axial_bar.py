"""均匀轴杆基础公式计算；AI 辅助草稿，待本人复核。不是有限元求解器。"""
import json
import math

if "input_text" not in globals():
    import pathlib
    import sys
    if len(sys.argv) != 2:
        raise SystemExit("用法: python axial_bar.py bar-input.json")
    input_text = pathlib.Path(sys.argv[1]).read_text(encoding="utf-8-sig")

data = json.loads(input_text)
if not isinstance(data, dict):
    raise ValueError("输入必须是 JSON 对象")
expected_units = {"E": "N/mm2", "A": "mm2", "L": "mm", "P": "N"}
values = {}
for name, unit in expected_units.items():
    item = data.get(name)
    if not isinstance(item, dict) or item.get("unit") != unit:
        raise ValueError(f"{name} 缺失或单位不等于 {unit}，不自行换算")
    value = item.get("value")
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError(f"{name} 必须是有限数值")
    if name != "P" and value <= 0:
        raise ValueError(f"{name} 必须大于 0")
    values[name] = value

E, A, L, P = (values[name] for name in ("E", "A", "L", "P"))
u = P * L / (E * A)
reaction = -P
energy = P * u / 2
print("环境：当前 Python 解释器中的教学公式计算，非 CAE 求解。")
print("假设：一维均匀直杆、小变形、线弹性、左端位移为零、仅右端轴向力。")
print("正方向：轴向向右为正；反力为左端支承对杆的作用。")
print(f"端位移 = {u:.9f} mm")
print(f"左端反力 = {reaction:.6f} N")
print(f"应变能 = {energy:.6f} N·mm（= {energy / 1000:.9f} J）")
print("公式：u=P*L/(E*A)，R=-P，U=P*u/2。未检查屈服、稳定或连接。")

