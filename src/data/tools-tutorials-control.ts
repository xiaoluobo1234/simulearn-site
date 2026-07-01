export const controlTutorials = {
  'control-flow-if': String.raw`
程序默认从上到下执行。条件判断让程序根据数据选择不同路径，例如输入是否有效、任务是否完成、数值位于哪个区间。Python 使用 \`if\`、\`elif\` 和 \`else\` 表示这些分支，冒号和缩进共同确定每个分支包含哪些语句。

## 最简单的 if

~~~python
temperature = 82

if temperature > 80:
    print("温度超过 80")

print("检查完成")
~~~

条件为真时执行缩进代码；无论条件真假，最后一行都会执行。条件表达式最终按照真值规则判断，不一定非要写成显式比较：

~~~python
items = ["case-A", "case-B"]

if items:
    print("共有", len(items), "项")
~~~

非空列表为真，空列表为假。

## if 与 else

~~~python
password = input("请输入口令：")

if password == "python":
    print("验证通过")
else:
    print("口令错误")
~~~

\`else\` 不写条件，它负责处理前面条件为假的所有情况。两个分支只会执行一个。

使用布尔变量可以让条件更清楚：

~~~python
value = 72
lower_limit = 60
upper_limit = 90
is_in_range = lower_limit <= value <= upper_limit

if is_in_range:
    print("数值在允许范围内")
else:
    print("数值超出范围")
~~~

## 多个互斥分支

~~~python
score = 86

if score >= 90:
    grade = "A"
elif score >= 80:
    grade = "B"
elif score >= 60:
    grade = "C"
else:
    grade = "D"

print(grade)
~~~

解释器从上到下检查，遇到第一个真条件后执行该分支，并跳过后续 \`elif\` 和 \`else\`。因此条件顺序很重要。如果先写 \`score >= 60\`，86 会过早进入该分支。

## 多个 if 不等于 if/elif

~~~python
number = 12

if number > 0:
    print("正数")

if number % 2 == 0:
    print("偶数")
~~~

两个独立 \`if\` 都可能执行，因为“正数”和“偶数”不是互斥关系。若改成 \`elif\`，第二个判断在第一个为真时不会检查。

选择结构时先问：这些条件能否同时成立？互斥分类通常使用 \`if/elif/else\`；独立规则通常使用多个 \`if\`。

## 嵌套判断

~~~python
file_exists = True
file_size = 2_400

if file_exists:
    if file_size > 0:
        print("文件可读取")
    else:
        print("文件为空")
else:
    print("文件不存在")
~~~

嵌套可以表达层级，但嵌套太深会难以阅读。很多情况可以用提前退出或组合条件简化：

~~~python
if file_exists and file_size > 0:
    print("文件可读取")
else:
    print("文件不存在或为空")
~~~

合并后信息更少，是否合适取决于是否需要区分失败原因。

## 条件表达式

简单二选一可以写成条件表达式：

~~~python
value = 75
status = "通过" if value >= 60 else "未通过"
print(status)
~~~

它适合短小赋值，不适合塞入复杂判断。可读性变差时应回到普通 \`if\`。

## match 适合结构化分支

现代 Python 支持 \`match\`，适合按明确值或数据结构分类：

~~~python
command = "start"

match command:
    case "start":
        print("开始任务")
    case "stop":
        print("停止任务")
    case "status":
        print("查看状态")
    case _:
        print("未知命令")
~~~

\`case _\` 类似默认分支。简单范围判断仍适合 \`if/elif\`，不要为了使用新语法而使用。

## 边界条件必须明确

~~~python
value = 100

if value < 0:
    print("小于零")
elif value <= 100:
    print("0 到 100，包含边界")
else:
    print("大于 100")
~~~

\`<\` 与 \`<=\` 的差别可能决定边界值进入哪个分支。编写条件前先用自然语言列出区间，并测试边界两侧。

## 一个输入校验程序

~~~python
text = input("请输入 0 到 100 的整数：").strip()

try:
    value = int(text)
except ValueError:
    print("输入不是整数")
else:
    if 0 <= value <= 100:
        print("输入有效")
    else:
        print("整数超出范围")
~~~

这里先处理格式，再判断范围。把所有问题写进一个复杂条件，会让错误原因不清楚。

## 本节检查

请分别测试 -1、0、59、60、89、90 和 100，确认分级代码没有遗漏或重叠。条件判断的核心不是关键字，而是把规则写成互斥或独立的清晰分支，并对边界、空值和异常输入给出明确行为。

> 📝 **相关练习**：[ex-python-control-flow-01] 编写分数等级判断并验证边界
`,

  'loops-for-while': String.raw`
循环用于重复执行代码。已知要遍历一组对象时通常使用 \`for\`；需要持续执行直到条件变化时通常使用 \`while\`。循环必须明确三件事：每次处理什么、何时结束、每轮产生什么结果。

## for 遍历序列

~~~python
names = ["case-A", "case-B", "case-C"]

for name in names:
    print("正在处理：", name)

print("全部完成")
~~~

\`name\` 每轮依次引用列表中的一个元素。循环结束后继续执行未缩进代码。

字符串、元组、字典、集合和文件等对象也可以迭代：

~~~python
for character in "Python":
    print(character)
~~~

## range() 生成整数序列

~~~python
for number in range(5):
    print(number)
~~~

输出 0 到 4，不包含结束值 5。完整形式是 \`range(start, stop, step)\`：

~~~python
print(list(range(2, 10, 2)))
print(list(range(5, 0, -1)))
~~~

结果为 \`[2, 4, 6, 8]\` 和 \`[5, 4, 3, 2, 1]\`。不要为了遍历列表而总写索引，能直接遍历元素时更清楚。

## enumerate() 同时取得编号

~~~python
names = ["case-A", "case-B", "case-C"]

for index, name in enumerate(names, start=1):
    print(index, name)
~~~

\`enumerate()\` 返回编号和元素，避免手动维护计数器。

多个序列可用 \`zip()\` 并行遍历：

~~~python
names = ["A", "B", "C"]
values = [12.5, 18.0, 9.6]

for name, value in zip(names, values):
    print(f"{name}: {value}")
~~~

默认情况下，较长序列多出的元素会被忽略，因此长度不一致时应主动检查。

## while 根据条件重复

~~~python
count = 1

while count <= 3:
    print("第", count, "次")
    count += 1
~~~

若忘记更新 \`count\`，条件永远为真，会形成死循环。设计 \`while\` 时必须指出哪个语句最终让条件变假。

一个输入重试例子：

~~~python
while True:
    text = input("请输入 q 退出：").strip().lower()

    if text == "q":
        break

    print("你输入了：", text)
~~~

\`while True\` 本身没有结束条件，必须依赖内部 \`break\`。它适合交互循环，但每条路径都应有退出办法。

## break 与 continue

\`break\` 立即结束当前循环：

~~~python
values = [12, 18, -1, 25]

for value in values:
    if value < 0:
        print("发现非法值，停止")
        break

    print("处理：", value)
~~~

\`continue\` 跳过本轮剩余语句，进入下一轮：

~~~python
values = [12, None, 18, None, 25]

for value in values:
    if value is None:
        continue

    print(value * 2)
~~~

不要滥用 \`continue\` 让控制流四处跳转。短循环中直接写正向条件通常更容易读。

## 循环中的 else

循环正常结束且没有执行 \`break\` 时，会执行 \`else\`：

~~~python
target = 18
values = [5, 12, 18, 30]

for value in values:
    if value == target:
        print("找到目标")
        break
else:
    print("没有找到目标")
~~~

这种写法可避免额外的“是否找到”标志变量，但团队不熟悉时也可以使用更直白的变量。

## 累计与筛选

~~~python
values = [12.5, 18.0, 9.5, 21.0]
total = 0.0
valid_count = 0

for value in values:
    if value >= 10:
        total += value
        valid_count += 1

average = total / valid_count
print(f"平均值：{average:.2f}")
~~~

真实代码应处理 \`valid_count == 0\` 的情况，否则会除零。

Python 也有内置 \`sum()\`、\`min()\`、\`max()\`，简单聚合优先使用它们：

~~~python
values = [12.5, 18.0, 9.5]
print(sum(values))
print(min(values))
print(max(values))
~~~

## 避免在遍历时修改原列表

~~~python
numbers = [1, 2, 3, 4, 5]

# 创建新列表，而不是边遍历边删除
even_numbers = []
for number in numbers:
    if number % 2 == 0:
        even_numbers.append(number)

print(even_numbers)
~~~

边遍历边增删同一个列表会改变后续索引，容易跳过元素。列表推导式会在列表课程中介绍。

## 本节检查

写一个程序遍历 1 到 100：统计能被 3 整除的数字个数，遇到第一个大于 80 且能被 7 整除的数字时停止，并输出该数字。先画出循环变量、判断和退出条件，再写代码。循环可靠与否，取决于边界和终止逻辑是否清晰。

> 📝 **相关练习**：[ex-python-loops-01] 编写遍历统计与提前终止程序
`,

  'lists': String.raw`
列表 \`list\` 是有序、可变的容器，可以保存任意对象。它适合表示一批按顺序处理的数据。所谓有序，是元素有稳定位置；所谓可变，是可以新增、删除或替换元素。列表是 Python 中最常用的数据结构之一。

## 创建与读取列表

~~~python
values = [12.5, 18.0, 9.6]
empty = []
mixed = ["case-A", 12.5, True]

print(values)
print(len(values))
print(empty)
print(mixed)
~~~

列表可以混合类型，但同一批业务数据通常保持一致类型更容易处理。

索引从 0 开始：

~~~python
names = ["A", "B", "C", "D"]

print(names[0])
print(names[-1])
print(names[1:3])
print(names[:2])
print(names[::2])
~~~

单个索引越界会报错；切片越界通常返回可用范围。切片会创建新列表：

~~~python
original = [1, 2, 3, 4]
part = original[1:3]
part[0] = 99

print(original)
print(part)
~~~

## 修改列表

~~~python
items = ["A", "B"]

items.append("C")
items.insert(1, "X")
items.extend(["D", "E"])

print(items)
~~~

\`append()\` 把一个对象作为末尾元素，\`extend()\` 把可迭代对象中的元素逐个加入：

~~~python
a = [1, 2]
b = [3, 4]

first = a.copy()
first.append(b)

second = a.copy()
second.extend(b)

print(first)
print(second)
~~~

结果分别是 \`[1, 2, [3, 4]]\` 和 \`[1, 2, 3, 4]\`。

替换元素直接赋值：

~~~python
values = [10, 20, 30]
values[1] = 25
values[0:2] = [11, 22]

print(values)
~~~

## 删除元素

~~~python
items = ["A", "B", "C", "B"]

items.remove("B")
last = items.pop()
del items[0]

print(items)
print(last)
~~~

\`remove(value)\` 删除第一个匹配值，找不到会报错；\`pop(index)\` 删除并返回指定位置，默认末尾；\`del\` 按索引或切片删除；\`clear()\` 清空列表。

需要保留原列表时，不要原地删除，可筛选生成新列表。

## 查找、计数与排序

~~~python
values = [18, 5, 12, 18]

print(18 in values)
print(values.index(12))
print(values.count(18))
~~~

原地排序：

~~~python
values = [18, 5, 12]
values.sort()
print(values)
~~~

返回新列表：

~~~python
values = [18, 5, 12]
ordered = sorted(values, reverse=True)

print(values)
print(ordered)
~~~

\`.sort()\` 返回 \`None\`，因此不要写 \`ordered = values.sort()\`。复杂对象可提供 \`key\`：

~~~python
records = [
    {"name": "A", "value": 18.0},
    {"name": "B", "value": 9.5},
]

records.sort(key=lambda item: item["value"])
print(records)
~~~

lambda 会在函数课程后继续理解；这里它告诉排序函数使用哪个字段。

## 列表推导式

~~~python
numbers = [1, 2, 3, 4, 5]
squares = [number ** 2 for number in numbers]
even_squares = [number ** 2 for number in numbers if number % 2 == 0]

print(squares)
print(even_squares)
~~~

推导式适合简单映射和筛选。逻辑超过一两个条件时，普通循环通常更清楚。

## 复制与嵌套列表

~~~python
original = [1, 2, 3]
alias = original
shallow_copy = original.copy()

alias.append(4)

print(original)
print(shallow_copy)
~~~

浅复制只复制最外层容器。嵌套对象仍共享：

~~~python
matrix = [[1, 2], [3, 4]]
copied = matrix.copy()
copied[0][0] = 99

print(matrix)
print(copied)
~~~

需要完全独立的嵌套副本可使用 \`copy.deepcopy()\`，但更重要的是理解数据是否本来就应该共享。

不要用下面写法创建二维列表：

~~~python
wrong = [[0, 0]] * 3
wrong[0][0] = 1
print(wrong)
~~~

三个元素引用同一个内部列表。正确方式：

~~~python
matrix = [[0, 0] for _ in range(3)]
matrix[0][0] = 1
print(matrix)
~~~

## 一个数据处理例子

~~~python
raw_values = [12.5, None, -1.0, 18.2, 9.8]
valid_values = []

for value in raw_values:
    if value is None or value < 0:
        continue
    valid_values.append(value)

average = sum(valid_values) / len(valid_values)

print(valid_values)
print(f"平均值：{average:.2f}")
~~~

真实程序还要处理没有有效值的情况。

## 本节要点

列表有顺序且可变；索引读取单项，切片生成新列表；\`append\` 与 \`extend\` 含义不同；\`.sort()\` 修改原列表，\`sorted()\` 返回新列表；浅复制不会复制嵌套对象。请创建一组包含重复值和缺失值的数据，完成清理、排序、去掉首尾极值并计算平均值。

> 📝 **相关练习**：[ex-python-lists-01] 清理数据列表并计算统计值
`,

  'tuples': String.raw`
元组 \`tuple\` 与列表一样是有序序列，但创建后不能增加、删除或替换元素。不可变性让它适合表达“这一组值构成一个固定记录”，也能用于拆包、函数多返回值和字典键。

## 创建元组

~~~python
point = (1.0, 2.0, 3.0)
empty = ()
single = (5,)

print(point)
print(empty)
print(single)
print(type(single))
~~~

单元素元组必须带逗号。括号并不是关键，逗号才创建元组：

~~~python
value = 5,
print(value)
print(type(value))
~~~

不过日常代码保留括号更清楚。

## 读取与切片

~~~python
point = (1.0, 2.0, 3.0)

print(point[0])
print(point[-1])
print(point[0:2])
~~~

元组支持索引、切片、遍历、\`len()\`、\`in\`、\`.count()\` 和 \`.index()\`。不能执行：

~~~python
point = (1.0, 2.0, 3.0)
# point[0] = 9.0  # TypeError
~~~

若确实要修改，可以转成列表后再转回，但频繁这样做通常说明应直接使用列表。

## 拆包

~~~python
point = (1.0, 2.0, 3.0)
x, y, z = point

print(x)
print(y)
print(z)
~~~

左右数量必须匹配。星号可以接收剩余项：

~~~python
record = ("case-A", 12.5, 18.0, 9.6)
name, first, *others = record

print(name)
print(first)
print(others)
~~~

\`others\` 是列表。也可以忽略不需要的值：

~~~python
name, _, value = ("case-A", "unused", 12.5)
print(name, value)
~~~

下划线只是普通变量名，但社区常用它表示“这里的值不使用”。

## 交换变量

~~~python
left = "A"
right = "B"

left, right = right, left
print(left, right)
~~~

右侧先构成元组，再拆包到左侧。这比手动临时变量更简洁。

## 函数返回多个值

~~~python
def minimum_and_maximum(values):
    return min(values), max(values)


result = minimum_and_maximum([8, 3, 12, 5])
print(result)

minimum, maximum = result
print(minimum, maximum)
~~~

函数实际上返回一个元组，调用者可以整体接收或直接拆包。

## 不可变不等于内部对象都不可变

~~~python
record = ("case-A", [10, 20])
record[1].append(30)

print(record)
~~~

元组不能更换第二个元素，但第二个元素本身是可变列表，列表内容仍能修改。所谓不可变，是元组保存的引用位置不变。

由于含有列表，这个元组不能作为字典键：

~~~python
hashable_point = (1.0, 2.0)
print(hash(hashable_point))

# unhashable_record = ("A", [1, 2])
# print(hash(unhashable_record))
~~~

对象只有在内容稳定且可哈希时才能安全作为字典键或集合元素。

## 元组与列表如何选择

列表更像“可增删的一批同类项目”，元组更像“固定字段组成的一条记录”。例如：

~~~python
load_cases = ["case-A", "case-B", "case-C"]
coordinate = (1.2, 3.4, 5.6)
rgb_color = (32, 128, 240)
~~~

这不是强制规则，但类型选择可以表达设计意图。若调用者不应改变返回记录，元组能提供一层保护。

## 使用 namedtuple 提高可读性

位置字段过多时，\`collections.namedtuple\` 可以给字段命名：

~~~python
from collections import namedtuple

Point = namedtuple("Point", ["x", "y", "z"])
point = Point(1.0, 2.0, 3.0)

print(point.x)
print(point[0])
~~~

现代代码也常用 \`dataclass\` 表示更复杂的数据模型，后续工程化课程会介绍。

## 一个处理例子

~~~python
records = [
    ("case-A", 12.5, True),
    ("case-B", 18.0, False),
    ("case-C", 9.6, True),
]

for name, value, is_valid in records:
    if is_valid:
        print(f"{name}: {value:.1f}")
~~~

每个元组结构固定，拆包后字段含义明确。若字段持续增加，字典或数据类会更合适。

## 本节要点

元组是有序、不可重新赋值的序列；单元素元组需要逗号；拆包能让多值处理更清楚；元组内部仍可能包含可变对象。请写一个函数返回一组数据的数量、最小值、最大值和平均值，再用拆包接收结果，并说明为什么这里使用元组是合理的。

> 📝 **相关练习**：[ex-python-tuples-01] 用元组拆包处理多项返回
`,

  'dicts': String.raw`
字典 \`dict\` 保存“键—值”映射。列表适合按位置访问，字典适合按名称、编号或其他唯一标识访问。配置项、人员信息、材料属性和结构化记录都常用字典表达。现代 Python 字典保留插入顺序，但它的核心仍是按键查找。

## 创建字典

~~~python
case = {
    "name": "case-A",
    "value": 12.5,
    "valid": True,
}

print(case)
print(case["name"])
print(case["value"])
~~~

键在同一字典中必须唯一。重复键会保留最后一个值：

~~~python
data = {"value": 10, "value": 20}
print(data)
~~~

字典值可以是任意对象，键必须可哈希，常用字符串、数字和元组。

## 读取键

方括号访问不存在的键会触发 \`KeyError\`：

~~~python
case = {"name": "case-A"}
# print(case["value"])
~~~

不确定键是否存在时使用 \`.get()\`：

~~~python
print(case.get("name"))
print(case.get("value"))
print(case.get("value", 0.0))
~~~

\`.get()\` 返回默认值并不代表数据真的存在。默认值可能掩盖缺失，因此关键字段仍应显式校验：

~~~python
required_keys = {"name", "value"}
missing = required_keys - case.keys()

if missing:
    print("缺少字段：", missing)
~~~

## 新增、修改与删除

~~~python
case = {"name": "case-A", "value": 12.5}

case["unit"] = "mm"
case["value"] = 13.0
removed = case.pop("unit")

print(case)
print(removed)
~~~

\`.update()\` 可以批量更新：

~~~python
settings = {"timeout": 30, "retry": 2}
settings.update({"timeout": 60, "log_level": "INFO"})
print(settings)
~~~

Python 还支持合并运算符：

~~~python
defaults = {"timeout": 30, "retry": 2}
custom = {"timeout": 90}
merged = defaults | custom

print(merged)
print(defaults)
~~~

后面的字典覆盖同名键，原字典不变。

## 遍历字典

~~~python
case = {"name": "case-A", "value": 12.5, "valid": True}

for key in case:
    print(key)

for value in case.values():
    print(value)

for key, value in case.items():
    print(key, value)
~~~

\`.keys()\`、\`.values()\` 和 \`.items()\` 返回动态视图。字典修改后，视图会反映变化。

遍历时不要直接改变字典大小：

~~~python
data = {"A": 1, "B": -1, "C": 3}

for key in list(data):
    if data[key] < 0:
        del data[key]

print(data)
~~~

先用 \`list(data)\` 固定键列表，避免运行时错误。更常见的方式是字典推导式：

~~~python
data = {"A": 1, "B": -1, "C": 3}
cleaned = {key: value for key, value in data.items() if value >= 0}
print(cleaned)
~~~

## 嵌套字典

~~~python
materials = {
    "steel": {
        "density": 7850,
        "elastic_modulus": 210e9,
    },
    "aluminum": {
        "density": 2700,
        "elastic_modulus": 70e9,
    },
}

print(materials["steel"]["density"])
~~~

嵌套层级过深会增加访问和校验成本。复杂数据应考虑数据类、Pydantic 模型或数据库。

安全读取嵌套字段时，不要无限链式 \`.get()\`。先检查数据结构更清楚：

~~~python
steel = materials.get("steel")

if isinstance(steel, dict) and "density" in steel:
    print(steel["density"])
else:
    print("材料数据不完整")
~~~

## setdefault 与 defaultdict

\`.setdefault()\` 在键不存在时写入默认值：

~~~python
groups = {}

for name, category in [("A", "low"), ("B", "high"), ("C", "low")]:
    groups.setdefault(category, []).append(name)

print(groups)
~~~

同类任务也可用 \`defaultdict\`：

~~~python
from collections import defaultdict

groups = defaultdict(list)
groups["low"].append("A")
groups["low"].append("C")

print(dict(groups))
~~~

## 字典键为什么必须可哈希

字典通过键的哈希值快速定位数据。键在生命周期中必须保持稳定，因此列表、字典和集合不能作为键；字符串、数字和只含可哈希元素的元组可以。

~~~python
coordinates = {
    (0, 0): "origin",
    (1, 0): "point-A",
}

print(coordinates[(1, 0)])
~~~

## 一个结构化记录例子

~~~python
records = [
    {"name": "A", "value": 12.5, "valid": True},
    {"name": "B", "value": None, "valid": False},
    {"name": "C", "value": 18.0, "valid": True},
]

valid_values = [
    record["value"]
    for record in records
    if record.get("valid") and record.get("value") is not None
]

print(valid_values)
print(sum(valid_values) / len(valid_values))
~~~

## 本节要点

字典通过键访问值；关键字段缺失时应明确报错，不能总用默认值掩盖；遍历 \`.items()\` 可同时取得键和值；嵌套结构需要校验。请设计一个“课程”字典，包含标题、课次、是否完成和标签列表，再编写代码检查必填字段并输出所有键值。

> 📝 **相关练习**：[ex-python-dicts-01] 设计课程字典并检查必填字段
`,
} as const;
