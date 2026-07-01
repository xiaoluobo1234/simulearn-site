export const languageTutorials = {
  'input-output': String.raw`
程序需要用某种方式接收信息并给出结果。最基础的输入来自键盘，最基础的输出显示在终端。Python 使用 \`input()\` 读取一行文本，使用 \`print()\` 输出对象。它们简单，却能帮助你理解数据从外部进入程序、被处理、再返回给用户的完整过程。

## 使用 print() 输出

\`print()\` 可以接收一个或多个对象：

~~~python
name = "小萝卜"
lesson = 6

print(name)
print("当前课程", lesson)
print("姓名：", name, "课程：", lesson)
~~~

多个对象之间默认用空格分隔，输出结束后默认换行。可以使用 \`sep\` 和 \`end\` 调整：

~~~python
print("2026", "06", "29", sep="-")
print("加载中", end="...")
print("完成")
~~~

输出结果：

~~~text
2026-06-29
加载中...完成
~~~

\`sep\` 只影响多个参数之间的分隔符，\`end\` 只影响本次输出末尾。不要为了拼接复杂文本堆叠很多逗号，格式化字符串通常更清楚。

## 使用 input() 读取键盘输入

~~~python
name = input("请输入姓名：")
print("你好，", name)
~~~

\`input()\` 会显示提示文字，暂停程序并等待用户按回车。返回值始终是字符串，即使用户输入的是数字：

~~~python
value = input("请输入一个数字：")
print(value)
print(type(value))
~~~

如果直接相加：

~~~python
first = input("第一个数字：")
second = input("第二个数字：")
print(first + second)
~~~

输入 2 和 3，结果是 \`23\` 而不是 \`5\`。原因是字符串的加号表示拼接。需要先转换：

~~~python
first = float(input("第一个数字："))
second = float(input("第二个数字："))
print("合计：", first + second)
~~~

转换可能失败，例如用户输入“abc”时会出现 \`ValueError\`。异常处理课程会介绍如何给出友好提示。

## 使用 f-string 格式化输出

f-string 在字符串前加字母 \`f\`，可以把表达式放进花括号：

~~~python
width = 3.2
height = 1.5
area = width * height

print(f"宽度为 {width} m，高度为 {height} m")
print(f"面积为 {area} m²")
~~~

它还可以控制小数位数：

~~~python
value = 12.345678

print(f"保留两位小数：{value:.2f}")
print(f"科学计数法：{value:.3e}")
print(f"百分比：{0.873:.1%}")
~~~

输出：

~~~text
保留两位小数：12.35
科学计数法：1.235e+01
百分比：87.3%
~~~

格式化只改变显示方式，不改变原变量。打印两位小数不等于计算过程中只保留两位。

## 控制数字宽度与对齐

表格型输出需要对齐：

~~~python
items = [
    ("case-A", 3.2),
    ("case-B", 18.75),
    ("long-case", 102.4),
]

for name, value in items:
    print(f"{name:<12} {value:>10.2f}")
~~~

\`<12\` 表示左对齐并占 12 个字符，\`>10.2f\` 表示右对齐、占 10 个字符并保留两位小数。终端报表使用固定宽度时非常实用。

## 输入内容需要清理

用户可能在前后输入空格。字符串方法 \`.strip()\` 可以清除两端空白：

~~~python
name = input("项目名称：").strip()

if name:
    print(f"已创建项目：{name}")
else:
    print("项目名称不能为空")
~~~

空字符串在条件判断中被视为假值。这个小程序已经包含输入、清理、判断和输出四个步骤。

## 输出不是返回值

\`print()\` 只是把内容显示给人，不会把计算结果交给其他代码：

~~~python
result = print("hello")
print(result)
~~~

第二行会输出 \`None\`，因为 \`print()\` 的返回值是 \`None\`。函数课程会区分“打印结果”和“返回结果”。

## 综合练习

~~~python
name = input("物品名称：").strip()
price = float(input("单价："))
quantity = int(input("数量："))
total = price * quantity

print("-" * 32)
print(f"{'物品':<8}{'单价':>10}{'数量':>6}{'合计':>8}")
print(f"{name:<8}{price:>10.2f}{quantity:>6}{total:>8.2f}")
~~~

请输入不同名称、价格和数量，观察对齐效果。然后尝试输入非数字，记录错误类型。本节的关键不是记住所有格式符，而是理解：外部输入默认不可信且通常是文本，输出应清楚表达数值含义、单位和精度。

> 📝 **相关练习**：[ex-python-input-output-01] 编写物品记录输入输出程序
`,

  'numbers-booleans-none': String.raw`
Python 的基础数值类型包括整数 \`int\` 和浮点数 \`float\`。布尔类型 \`bool\` 只有 \`True\` 与 \`False\`，用于表达判断结果；\`None\` 表示“没有值”或“尚未得到结果”。它们看似简单，却决定了计算、判断和数据缺失的表达方式。

## 整数与浮点数

~~~python
node_count = 120
length = 2.5

print(type(node_count))
print(type(length))
~~~

整数没有小数部分，Python 整数可以非常大；浮点数用于近似表示带小数的实数。常见运算如下：

~~~python
a = 7
b = 3

print(a + b)   # 加
print(a - b)   # 减
print(a * b)   # 乘
print(a / b)   # 真除法
print(a // b)  # 向下取整除法
print(a % b)   # 余数
print(a ** b)  # 幂
~~~

\`/\` 的结果通常是浮点数；\`//\` 不是简单“去掉小数”，而是向负无穷取整：

~~~python
print(7 // 3)
print(-7 // 3)
~~~

输出为 \`2\` 和 \`-3\`。处理负数时必须注意这一点。

## 浮点数是近似值

~~~python
result = 0.1 + 0.2
print(result)
print(result == 0.3)
~~~

你可能看到 \`0.30000000000000004\` 和 \`False\`。原因不是 Python 算错，而是许多十进制小数无法用有限二进制位精确表示。

比较浮点计算结果时应使用容差：

~~~python
from math import isclose

result = 0.1 + 0.2
print(isclose(result, 0.3))
print(isclose(result, 0.3, rel_tol=1e-9, abs_tol=1e-12))
~~~

\`rel_tol\` 是相对容差，\`abs_tol\` 是接近零时使用的绝对容差。具体阈值应根据数据尺度和业务要求决定，不能机械复制。

## 科学计数法与特殊浮点值

~~~python
youngs_modulus = 2.1e11
small_value = 3.5e-6

print(youngs_modulus)
print(small_value)
~~~

\`e11\` 表示乘以 10 的 11 次方。Python 还支持无穷大和非数字：

~~~python
import math

positive_inf = float("inf")
not_a_number = float("nan")

print(math.isinf(positive_inf))
print(math.isnan(not_a_number))
~~~

\`nan\` 与任何值比较都不相等，甚至不等于自身。数据中出现 \`nan\` 时应明确处理，而不是让它悄悄传播到最终结果。

## 布尔值来自判断

~~~python
temperature = 82
limit = 90

is_safe = temperature < limit
is_equal = temperature == limit

print(is_safe)
print(is_equal)
~~~

比较运算返回布尔值。布尔值可以组合：

~~~python
is_converged = True
has_error = False
can_export = is_converged and not has_error

print(can_export)
~~~

\`and\` 要求两边都真，\`or\` 只需一边为真，\`not\` 取反。不要把布尔变量写成字符串 \`"True"\` 或 \`"False"\`，非空字符串在条件中都被视为真。

## 真值与假值

在条件判断中，\`0\`、\`0.0\`、空字符串、空列表、空字典、空集合和 \`None\` 都是假值，其他大多数对象是真值：

~~~python
values = [0, 1, "", "0", [], [0], None]

for value in values:
    print(repr(value), bool(value))
~~~

这种规则可以简化空值检查：

~~~python
items = []

if items:
    print("有数据")
else:
    print("列表为空")
~~~

但涉及数值零时要谨慎。零可能是合法结果，不能总被当作“缺失”。

## None 表示没有结果

~~~python
result = None

if result is None:
    print("尚未计算")
~~~

检查 \`None\` 推荐使用 \`is None\`，而不是 \`== None\`。函数没有显式 \`return\` 时默认返回 \`None\`：

~~~python
def show_message():
    print("执行完成")


value = show_message()
print(value)
~~~

\`None\` 不等于 0、空字符串或 \`False\`。它表达的是“没有对象”，语义不同。

## 数字中的下划线

长数字可使用下划线提高可读性：

~~~python
one_million = 1_000_000
pressure = 101_325.0

print(one_million)
print(pressure)
~~~

下划线不改变数值。清晰书写数量级比省几个字符重要。

## 本节检查

请解释 \`/\` 与 \`//\`、\`0\` 与 \`None\`、布尔值与字符串 \`"False"\` 的区别。再运行浮点数示例，尝试不同容差。写数值代码时必须同时关注类型、数量级、近似误差和缺失值，这些问题比语法本身更容易造成隐蔽错误。

> 📝 **相关练习**：[ex-python-numbers-01] 用浮点容差验证计算结果
`,

  'strings-basics': String.raw`
字符串 \`str\` 用来表示文本。文件路径、日志、名称、单位、配置内容和终端输入都离不开字符串。Python 字符串是有顺序、不可变的字符序列：可以读取某个位置，也可以生成修改后的新字符串，但不能直接改写原字符串中的单个字符。

## 创建字符串

~~~python
single = 'Python'
double = "Python"
multiline = """第一行
第二行"""

print(single)
print(double)
print(multiline)
~~~

单引号和双引号作用相同，可根据文本内容选择：

~~~python
message = "I'm learning Python."
quote = '他说："开始运行。"'
print(message)
print(quote)
~~~

反斜杠可表示换行、制表符和引号：

~~~python
print("第一行\n第二行")
print("名称\t数值")
print("路径：C:\\study\\python")
~~~

Windows 路径也可以使用原始字符串：

~~~python
path = r"C:\study\python\data.txt"
print(path)
~~~

原始字符串会减少转义，但不能以单个反斜杠结尾。

## 索引与切片

字符串从左到右索引从 0 开始，从右到左可用负数：

~~~python
text = "Python"

print(text[0])
print(text[1])
print(text[-1])
~~~

切片语法是 \`字符串[开始:结束:步长]\`，结束位置不包含在结果中：

~~~python
text = "Python"

print(text[0:3])
print(text[3:])
print(text[:4])
print(text[::-1])
~~~

切片越界通常不会报错，而单个索引越界会触发 \`IndexError\`。

## 字符串不可变

下面代码会失败：

~~~python
word = "cat"
# word[0] = "b"  # TypeError
~~~

要得到 \`bat\`，应创建新字符串：

~~~python
word = "cat"
new_word = "b" + word[1:]

print(word)
print(new_word)
~~~

字符串方法同样返回新字符串：

~~~python
raw_name = "  Case-A  "
clean_name = raw_name.strip().lower()

print(repr(raw_name))
print(repr(clean_name))
~~~

\`.strip()\` 清除两端空白，\`.lower()\` 转为小写。原字符串不变。

## 查找、替换与判断

~~~python
message = "solver finished with warning"

print("warning" in message)
print(message.find("finished"))
print(message.startswith("solver"))
print(message.endswith("error"))
~~~

\`in\` 返回布尔值；\`.find()\` 返回起始位置，找不到时返回 -1。若必须找到内容，可用 \`.index()\`，找不到会抛出异常。

~~~python
text = "case_01_result.txt"
new_text = text.replace("case_01", "case_02")
print(new_text)
~~~

\`.replace()\` 默认替换全部匹配项，也可以传第三个参数限制次数。

## 分割与连接

~~~python
line = "node,ux,uy,uz"
columns = line.split(",")

print(columns)
print(columns[0])
~~~

\`.split()\` 把字符串拆成列表；\`.join()\` 把一组字符串连接起来：

~~~python
parts = ["2026", "06", "29"]
date_text = "-".join(parts)

print(date_text)
~~~

\`join\` 的调用者是分隔符。列表元素必须都是字符串，否则会触发 \`TypeError\`：

~~~python
numbers = [1, 2, 3]
text = ",".join(str(number) for number in numbers)
print(text)
~~~

## f-string

~~~python
name = "case-A"
value = 12.3456

print(f"{name} 的结果为 {value:.2f}")
print(f"{name=}, {value=}")
~~~

花括号中可以写表达式，但不宜塞入复杂逻辑。复杂计算应先保存到变量，再格式化输出。

## Unicode 与长度

Python 3 字符串使用 Unicode：

~~~python
text = "温度 A"

print(len(text))
for character in text:
    print(character)
~~~

\`len()\` 返回 Python 字符数量，不一定等于文件字节数。编码为 UTF-8 后可查看字节：

~~~python
text = "温度"
data = text.encode("utf-8")

print(data)
print(len(text), len(data))
~~~

文件读写课程会继续介绍编码。

## 一个文本清理例子

~~~python
raw_line = "  CASE-01,  125.40 MPa  "
clean_line = raw_line.strip().lower()
case_name, value_text = clean_line.split(",", maxsplit=1)

value_text = value_text.strip().removesuffix(" mpa")

print(case_name)
print(value_text)
~~~

这个例子依次完成去空白、统一大小写、分割和删除后缀。真实数据清理应保留原始文本，并对格式不符合预期的行明确报错。

## 本节要点

字符串是不可变序列；索引读取一个字符，切片生成子串；方法通常返回新字符串；\`split\` 与 \`join\` 完成拆分和组合；f-string 负责清楚输出。请尝试解析 \`"point-12: 86.5 C"\`，分别取出名称、数值和单位，并说明每一步返回的数据类型。

> 📝 **相关练习**：[ex-python-strings-01] 解析传感器数据字符串
`,

  'type-conversion': String.raw`
Python 不会在所有场景中自动替你转换类型。字符串 \`"10"\`、整数 \`10\` 和浮点数 \`10.0\` 看起来接近，却是不同对象，支持的运算也不同。类型转换的目标不是让错误消失，而是明确数据应当具有什么含义，并在转换失败时采取合理措施。

## 查看对象类型

~~~python
values = [10, 10.0, "10", True, None]

for value in values:
    print(repr(value), type(value))
~~~

\`type()\` 返回对象的具体类型。判断对象是否属于某种类型时，\`isinstance()\` 更适合：

~~~python
value = 12

print(isinstance(value, int))
print(isinstance(value, (int, float)))
~~~

第二个参数可以是类型元组。需要注意，\`bool\` 是 \`int\` 的子类：

~~~python
print(isinstance(True, int))
print(int(True))
~~~

因此对“必须是普通整数”的严格校验不能只依赖这一条判断。

## 转换为整数

~~~python
print(int("42"))
print(int(3.9))
print(int(-3.9))
~~~

浮点数转整数是向零截断，不是四舍五入。若需要舍入，使用 \`round()\` 并理解其规则：

~~~python
print(round(3.6))
print(round(2.5))
print(round(3.5))
~~~

Python 的 \`round()\` 在恰好位于中间时采用“取偶”策略，不能假定所有 .5 都向上。

带小数点的字符串不能直接交给 \`int()\`：

~~~python
text = "12.8"
number = int(float(text))
print(number)
~~~

这会先得到浮点数，再截断为整数。业务上是否允许截断必须明确，不应为了通过转换而盲目连用函数。

## 转换为浮点数和字符串

~~~python
print(float("3.14"))
print(float("1e-3"))
print(str(125.4))
~~~

\`float()\` 接受普通十进制和科学计数法字符串。带单位的 \`"125 MPa"\` 不能直接转换，必须先拆分：

~~~python
text = "125.4 MPa"
value_text, unit = text.split()
value = float(value_text)

print(value)
print(unit)
~~~

\`str()\` 可以生成面向人的文本表示，但复杂对象的字符串未必适合长期存储。结构化数据更适合 JSON、CSV 或数据库。

## 布尔转换容易误解

~~~python
print(bool(0))
print(bool(1))
print(bool(""))
print(bool("False"))
~~~

最后一个结果是 \`True\`，因为任何非空字符串都是真值。把配置文本转换成布尔值，应明确解析允许的写法：

~~~python
def parse_bool(text):
    normalized = text.strip().lower()

    if normalized in {"true", "yes", "1", "on"}:
        return True
    if normalized in {"false", "no", "0", "off"}:
        return False

    raise ValueError(f"无法识别布尔值：{text}")


print(parse_bool("YES"))
print(parse_bool("off"))
~~~

这种写法把接受规则集中到一个函数中，也能明确拒绝模糊输入。

## 安全处理用户输入

~~~python
text = input("请输入数量：").strip()

try:
    quantity = int(text)
except ValueError:
    print(f"{text!r} 不是有效整数")
else:
    print("数量为：", quantity)
~~~

\`try/except\` 捕获转换失败，\`else\` 只在转换成功时执行。异常课程会详细介绍。

若只想先判断一个字符串是否由十进制数字字符组成，可以使用 \`.isdigit()\`：

~~~python
for text in ["12", "-12", "12.5", "１２"]:
    print(text, text.isdigit())
~~~

但它不能完整判断负数、小数和所有业务格式，因此“先 isdigit 再转换”不是通用解析方案。最可靠的方法通常是直接尝试目标转换并处理异常。

## 容器类型之间的转换

~~~python
numbers = [3, 1, 3, 2, 1]
unique_numbers = set(numbers)
sorted_numbers = sorted(unique_numbers)
result_tuple = tuple(sorted_numbers)

print(unique_numbers)
print(sorted_numbers)
print(result_tuple)
~~~

列表转集合会去重但失去位置语义；集合排序得到新列表；列表转元组得到不可变序列。每次转换都可能改变数据性质，不能只看外观。

字典可以从键值对构造：

~~~python
pairs = [("name", "case-A"), ("value", 12.5)]
data = dict(pairs)
print(data)
~~~

## 不要用转换掩盖设计问题

如果代码中到处出现 \`str()\`、\`float()\` 和 \`int()\`，通常说明数据入口没有统一。更好的方式是在输入边界完成一次验证和转换，后续函数只接收明确类型。

例如：

~~~python
def calculate_total(price, quantity):
    if not isinstance(price, (int, float)):
        raise TypeError("price 必须是数字")
    if not isinstance(quantity, int):
        raise TypeError("quantity 必须是整数")
    return price * quantity


print(calculate_total(12.5, 4))
~~~

## 本节要点

类型转换会改变数据表示，有时还会丢失信息；\`int(float_value)\` 是截断，不是舍入；非空字符串转布尔值都为真；失败的转换应明确处理。请编写一个函数，把 \`" 18.5 kg "\` 解析为数值和单位，并分别测试正常文本、缺少单位和无法转换的文本。

> 📝 **相关练习**：[ex-python-type-conversion-01] 编写安全解析函数
`,

  'basic-operators': String.raw`
运算符把一个或多个对象组合成表达式。表达式会产生结果，可以继续赋值、比较或传给函数。Python 运算符不仅用于数字，也会根据对象类型表现出不同含义。例如加号既能做数值加法，也能拼接字符串和列表。

## 算术运算符

~~~python
a = 10
b = 3

print(a + b)
print(a - b)
print(a * b)
print(a / b)
print(a // b)
print(a % b)
print(a ** b)
~~~

\`%\` 返回余数，可用于判断整除：

~~~python
number = 18

print(number % 2 == 0)
print(number % 5 == 0)
~~~

幂运算符 \`**\` 的优先级较高：

~~~python
print(-2 ** 2)
print((-2) ** 2)
~~~

结果分别为 -4 和 4。需要表达负数平方时主动使用括号。

## 比较运算符

~~~python
value = 12.5

print(value == 12.5)
print(value != 10)
print(value > 10)
print(value <= 15)
~~~

\`=\` 是赋值，\`==\` 是比较。Python 支持链式比较：

~~~python
temperature = 65
print(20 <= temperature <= 80)
~~~

它比 \`temperature >= 20 and temperature <= 80\` 更接近数学写法。

字符串按 Unicode 编码顺序比较，不应把这种结果当作自然语言排序：

~~~python
print("A" < "B")
print("10" < "2")
~~~

第二个结果是 \`True\`，因为比较的是字符，而不是数值。

## 逻辑运算符与短路

~~~python
is_ready = True
has_error = False

print(is_ready and not has_error)
print(is_ready or has_error)
~~~

\`and\` 在左侧为假时不再计算右侧；\`or\` 在左侧为真时不再计算右侧。这叫短路求值：

~~~python
items = []

if items and items[0] > 0:
    print("第一个元素为正数")
else:
    print("没有可检查的正数")
~~~

列表为空时，右侧 \`items[0]\` 不会执行，因此不会产生 \`IndexError\`。

\`and\` 和 \`or\` 返回的不一定是布尔值：

~~~python
name = ""
display_name = name or "未命名"
print(display_name)
~~~

它返回第一个能决定结果的对象。虽然这种写法简洁，但涉及 0、空字符串等合法值时要确认语义。

## 成员与身份运算符

\`in\` 判断成员：

~~~python
allowed_units = {"m", "mm", "kg"}

print("mm" in allowed_units)
print("MPa" not in allowed_units)
~~~

\`is\` 判断两个名字是否引用同一个对象，\`==\` 判断内容是否相等：

~~~python
a = [1, 2]
b = [1, 2]
c = a

print(a == b)
print(a is b)
print(a is c)
~~~

检查 \`None\` 使用 \`is None\`。普通数值和字符串比较通常使用 \`==\`，不要依赖解释器可能进行的对象复用。

## 赋值运算符

~~~python
count = 10
count += 2
count *= 3
print(count)
~~~

增强赋值会读取旧值、执行运算再赋回。对可变对象，它可能直接修改原对象：

~~~python
a = [1, 2]
b = a
a += [3]

print(a)
print(b)
~~~

\`a\` 和 \`b\` 都会看到新增元素。若写成 \`a = a + [3]\`，则会创建新列表并重新绑定 \`a\`。理解这一差别有助于排查共享数据被意外修改的问题。

## 优先级与括号

~~~python
result_1 = 2 + 3 * 4
result_2 = (2 + 3) * 4

print(result_1)
print(result_2)
~~~

乘除先于加减，比较先于 \`not\`、\`and\`、\`or\`。但可读性比展示记忆力重要。表达式包含多种运算符时，应使用括号明确意图：

~~~python
is_valid = (
    value >= 0
    and value <= 100
    and unit in allowed_units
)
~~~

## 浮点比较

~~~python
from math import isclose

calculated = 0.1 + 0.2
expected = 0.3

print(calculated == expected)
print(isclose(calculated, expected, rel_tol=1e-9))
~~~

对测量值、计算结果和不同算法结果，不应直接套用同一个容差。容差是业务判据的一部分。

## 一个完整判断

~~~python
value = 85.0
lower_limit = 0.0
upper_limit = 100.0
status = "ready"

is_acceptable = (
    lower_limit <= value <= upper_limit
    and status == "ready"
)

print(f"结果是否可接受：{is_acceptable}")
~~~

尝试把状态改为空字符串、把上限改为 80，并逐项解释结果。运算符学习的重点不是背优先级表，而是写出不会误解、能处理边界、且符合数据类型含义的表达式。

> 📝 **相关练习**：[ex-python-operators-01] 用逻辑短路安全读取列表
`,
} as const;
