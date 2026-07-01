export const structureTutorials = {
  'sets': String.raw`
集合 \`set\` 是一组不重复、无位置索引的可哈希对象。它最适合解决三类问题：去重、快速成员判断、集合关系运算。列表强调顺序和重复次数，集合强调“某个元素是否属于这组数据”。

## 创建集合

~~~python
names = {"A", "B", "C"}
empty_set = set()

print(names)
print(type(empty_set))
~~~

空集合不能写成 \`{}\`，因为那表示空字典。集合显示顺序可能与输入不同，不能依赖打印顺序。

从列表去重：

~~~python
numbers = [3, 1, 3, 2, 1, 2]
unique_numbers = set(numbers)

print(unique_numbers)
print(sorted(unique_numbers))
~~~

转换为集合会丢失重复次数和原始位置。若要在保留首次出现顺序的同时去重，可以利用字典：

~~~python
numbers = [3, 1, 3, 2, 1, 2]
ordered_unique = list(dict.fromkeys(numbers))
print(ordered_unique)
~~~

## 添加与删除

~~~python
items = {"A", "B"}

items.add("C")
items.update(["D", "E"])
items.discard("B")

print(items)
~~~

\`.add()\` 添加一个对象，\`.update()\` 添加可迭代对象中的多项。\`.remove()\` 在元素不存在时抛出 \`KeyError\`，\`.discard()\` 在不存在时什么也不做：

~~~python
items = {"A", "B"}

items.discard("X")
# items.remove("X")  # KeyError
~~~

\`.pop()\` 会删除并返回任意元素，不表示“最后一个”：

~~~python
items = {"A", "B", "C"}
removed = items.pop()
print(removed)
print(items)
~~~

## 成员判断

~~~python
allowed_extensions = {".txt", ".csv", ".json"}

print(".csv" in allowed_extensions)
print(".exe" not in allowed_extensions)
~~~

集合成员判断平均速度通常比列表快，尤其适合频繁检查较大名单。小数据中优先考虑语义清晰，不必为了微小性能差异过度优化。

## 交集、并集和差集

~~~python
group_a = {"A", "B", "C"}
group_b = {"B", "C", "D"}

print(group_a & group_b)  # 交集
print(group_a | group_b)  # 并集
print(group_a - group_b)  # 差集
print(group_a ^ group_b)  # 对称差
~~~

方法写法同样可用：

~~~python
print(group_a.intersection(group_b))
print(group_a.union(group_b))
print(group_a.difference(group_b))
~~~

运算符要求两边都是集合，方法可以接受其他可迭代对象，使用时应保持团队风格一致。

## 子集与超集

~~~python
required = {"name", "value"}
received = {"name", "value", "unit"}

print(required <= received)
print(received >= required)
print(required < received)
~~~

\`<=\` 表示子集，\`<\` 表示真子集。检查必填字段非常直观：

~~~python
required = {"name", "value", "unit"}
record = {"name": "case-A", "value": 12.5}
missing = required - record.keys()

if missing:
    print("缺少字段：", sorted(missing))
~~~

字典键视图可以直接参与集合运算。

## 集合元素必须可哈希

~~~python
valid = {(0, 0), (1, 0), (1, 1)}
print(valid)

# invalid = {[0, 0], [1, 0]}  # TypeError
~~~

列表可修改，哈希值无法稳定，因此不能作为集合元素。元组只有在所有内部元素都可哈希时才可使用。

## frozenset

\`frozenset\` 是不可变集合，可作为字典键或另一个集合的元素：

~~~python
edge = frozenset({10, 20})
labels = {edge: "boundary-A"}

print(labels[frozenset({20, 10})])
~~~

集合不关心顺序，因此两个端点交换后仍表示同一组成员。

## 集合推导式

~~~python
words = ["Python", "python", "DATA", "data", "Tool"]
normalized = {word.lower() for word in words}
print(normalized)
~~~

可以同时筛选：

~~~python
numbers = range(1, 11)
even_squares = {number ** 2 for number in numbers if number % 2 == 0}
print(even_squares)
~~~

## 一个名单比较例子

~~~python
expected = {"case-A", "case-B", "case-C"}
completed = {"case-A", "case-C", "case-D"}

missing = expected - completed
unexpected = completed - expected
common = expected & completed

print("已完成：", sorted(common))
print("缺少：", sorted(missing))
print("计划外：", sorted(unexpected))
~~~

这比嵌套循环逐项比较更直接。

## 本节要点

集合无索引、不保留重复项；去重时要确认是否允许丢失顺序和计数；交并差能清楚表达两组数据关系；元素必须可哈希。请比较两份文件名列表，输出共有文件、只在第一份出现的文件、只在第二份出现的文件，并按名称排序显示。

> 📝 **相关练习**：[ex-python-sets-01] 用集合比较文件列表
`,

  'functions': String.raw`
函数把一段有明确职责的代码命名并封装起来。它接收参数、执行处理、返回结果。函数能减少重复，更重要的是让程序被拆成可理解、可测试的小单元。一个函数应尽量只完成一件能用一句话说明的事。

## 定义和调用函数

~~~python
def calculate_area(width, height):
    area = width * height
    return area


result = calculate_area(3.0, 2.0)
print(result)
~~~

\`def\` 定义函数，括号中是参数，\`return\` 把结果交给调用者。定义函数不会自动执行函数体，只有调用时才执行。

不要混淆 \`return\` 与 \`print()\`：

~~~python
def show_area(width, height):
    print(width * height)


value = show_area(3.0, 2.0)
print("返回值：", value)
~~~

函数打印了面积，但返回值是 \`None\`。可复用函数通常返回数据，由调用者决定是否打印、保存或继续计算。

## 位置参数与关键字参数

~~~python
def format_result(name, value, unit):
    return f"{name}: {value:.2f} {unit}"


print(format_result("length", 12.5, "mm"))
print(format_result(value=12.5, unit="mm", name="length"))
~~~

位置参数依赖顺序；关键字参数直接写名称，复杂调用更清楚。位置参数必须位于关键字参数之前。

## 默认参数

~~~python
def format_result(name, value, unit="-", digits=2):
    return f"{name}: {value:.{digits}f} {unit}"


print(format_result("ratio", 0.12345))
print(format_result("length", 12.345, "mm", digits=1))
~~~

有默认值的参数应放在无默认值参数之后。

默认参数在函数定义时只创建一次。不要把可变对象作为默认值：

~~~python
def add_item_wrong(item, items=[]):
    items.append(item)
    return items


print(add_item_wrong("A"))
print(add_item_wrong("B"))
~~~

第二次会保留第一次的内容。正确方式：

~~~python
def add_item(item, items=None):
    if items is None:
        items = []

    items.append(item)
    return items


print(add_item("A"))
print(add_item("B"))
~~~

## 返回多个值

~~~python
def summarize(values):
    minimum = min(values)
    maximum = max(values)
    average = sum(values) / len(values)
    return minimum, maximum, average


low, high, mean = summarize([3, 8, 5, 12])
print(low, high, mean)
~~~

多个返回值实际组成元组。函数应明确空列表如何处理，否则 \`min()\` 和除法会失败。

## 作用域

~~~python
rate = 1.2


def calculate(value):
    result = value * rate
    return result


print(calculate(10))
# print(result)  # NameError
~~~

\`rate\` 是全局变量，函数内部可读取；\`result\` 是局部变量，函数外不可访问。函数依赖大量全局变量会难以测试，通常应通过参数传入。

~~~python
def calculate(value, rate):
    return value * rate


print(calculate(10, 1.2))
~~~

这样调用关系更明确。

## 可变参数

\`*args\` 收集额外位置参数：

~~~python
def average(*values):
    if not values:
        raise ValueError("至少需要一个数值")
    return sum(values) / len(values)


print(average(10, 20, 30))
~~~

\`**kwargs\` 收集额外关键字参数：

~~~python
def show_settings(**settings):
    for key, value in settings.items():
        print(key, "=", value)


show_settings(timeout=30, retry=2)
~~~

不要为了“灵活”把所有函数都写成 \`*args, **kwargs\`，这会隐藏接口。

## 类型注解与文档字符串

~~~python
def calculate_area(width: float, height: float) -> float:
    """计算矩形面积。

    参数必须使用相同长度单位，返回对应的平方单位。
    """
    if width < 0 or height < 0:
        raise ValueError("长度不能为负数")
    return width * height


print(calculate_area(3.0, 2.0))
~~~

类型注解帮助编辑器和阅读者理解接口，但 Python 默认不会强制检查。函数仍应验证关键业务约束。

## 函数是一等对象

~~~python
def double(value):
    return value * 2


operation = double
print(operation(5))

values = [1, 2, 3]
print(list(map(double, values)))
~~~

函数可以赋给变量、传给其他函数或存入数据结构。后续装饰器、回调和策略模式都建立在这个特性上。

## 拆分一个程序

~~~python
def parse_number(text):
    return float(text.strip())


def is_in_range(value, lower, upper):
    return lower <= value <= upper


def main():
    text = input("请输入数值：")
    value = parse_number(text)
    valid = is_in_range(value, 0, 100)
    print("是否有效：", valid)


if __name__ == "__main__":
    main()
~~~

解析、判断和交互被分开，每个函数都容易单独测试。

## 本节要点

函数应有明确输入、输出和职责；\`return\` 返回数据，\`print\` 只显示；避免可变默认参数和隐式全局依赖；类型注解不替代运行时校验。请把一个读取三个数并计算平均值的脚本拆成“解析输入、计算统计、格式化输出”三个函数。

> 📝 **相关练习**：[ex-python-functions-01] 拆分程序为三个独立函数
`,

  'modules-packages': String.raw`
当程序变长时，把所有代码放在一个文件中会难以查找、测试和复用。一个 \`.py\` 文件就是模块；包是按目录组织的一组模块。导入机制让一个文件使用另一个文件或标准库中的名称。

## 导入标准库模块

~~~python
import math

radius = 2.0
area = math.pi * radius ** 2
print(area)
~~~

\`import math\` 把模块对象绑定到名字 \`math\`，使用成员时写 \`math.pi\`、\`math.sqrt()\`。这种写法清楚显示名称来自哪里。

也可以只导入需要的名称：

~~~python
from math import pi, sqrt

print(pi)
print(sqrt(25))
~~~

别名可缩短常用模块名或解决冲突：

~~~python
import statistics as stats

print(stats.mean([10, 20, 30]))
~~~

不要使用 \`from module import *\`。它把大量未知名称放入当前作用域，容易覆盖已有变量，也让阅读者无法判断来源。

## 创建自己的模块

在同一文件夹创建 \`calculations.py\`：

~~~python
def rectangle_area(width, height):
    return width * height


def circle_area(radius):
    from math import pi
    return pi * radius ** 2
~~~

再创建 \`main.py\`：

~~~python
import calculations

print(calculations.rectangle_area(3.0, 2.0))
print(calculations.circle_area(1.5))
~~~

在该文件夹运行 \`python main.py\`。模块名就是不带 \`.py\` 的文件名。

## 模块顶层代码会执行

若 \`calculations.py\` 末尾直接写：

~~~python
print("calculations 模块已加载")
~~~

首次导入时这行会执行。模块顶层通常只放常量、定义和必要初始化，不要自动执行耗时任务。

使用主入口保护演示代码：

~~~python
def rectangle_area(width, height):
    return width * height


if __name__ == "__main__":
    print(rectangle_area(3.0, 2.0))
~~~

直接运行模块时 \`__name__\` 为 \`"__main__"\`；被导入时它是模块名，因此演示代码不会执行。

## Python 在哪里查找模块

~~~python
import sys

for path in sys.path:
    print(path)
~~~

解释器会在脚本目录、环境配置和已安装包目录中查找。出现 \`ModuleNotFoundError\` 时应检查：

1. 模块是否真的安装或位于项目中；
2. 文件名与导入名是否一致；
3. 当前解释器是否正确；
4. 是否在正确目录运行；
5. 是否用自己的文件名覆盖了标准库。

例如把文件命名为 \`json.py\`，再 \`import json\`，很可能导入自己的文件而非标准库。

## 组织一个包

目录结构：

~~~text
python-study/
├─ main.py
└─ study_tools/
   ├─ __init__.py
   ├─ calculations.py
   └─ formatting.py
~~~

\`main.py\`：

~~~python
from study_tools.calculations import rectangle_area
from study_tools.formatting import format_value

area = rectangle_area(3.0, 2.0)
print(format_value("area", area, "m²"))
~~~

\`__init__.py\` 表明目录是常规包，也可定义包对外接口。不要在其中堆积复杂逻辑。

包内部可使用相对导入：

~~~python
# study_tools/reporting.py
from .formatting import format_value
~~~

应用入口通常使用绝对导入更清楚；包内部相对导入能表示同一包内关系。

## 标准库与第三方包

标准库无需额外安装，例如 \`pathlib\`、\`json\`、\`csv\`、\`math\`。第三方包来自 PyPI 等仓库，需要用 pip 安装：

~~~powershell
python -m pip install package-name
~~~

查看安装位置：

~~~powershell
python -m pip show package-name
~~~

不要把“安装包名”和“导入名”必然视为相同，它们有时不同，应查看项目文档。

## 避免循环导入

\`a.py\` 导入 \`b.py\`，同时 \`b.py\` 又在顶层导入 \`a.py\`，可能导致对象尚未定义。解决方法不是调整随机顺序，而是重新划分职责：把共享类型或函数提取到第三个模块，或者把依赖方向改为单向。

## 查看模块内容

~~~python
import math

print(math.__name__)
print(math.__doc__[:80])
print(dir(math)[:10])
help(math.sqrt)
~~~

\`dir()\` 用于探索名称，\`help()\` 查看文档。不要依赖以下划线开头的内部成员，它们通常不是稳定公开接口。

## 本节要点

模块是 Python 文件，包是模块目录；导入会执行模块顶层代码；显式模块前缀能说明名称来源；主入口保护避免导入时误执行。请把上一课的三个函数拆分为 \`parsing.py\`、\`statistics_tools.py\` 和 \`main.py\`，确认每个模块可以单独导入。

> 📝 **相关练习**：[ex-python-modules-01] 将函数拆分为独立模块
`,

  'file-io': String.raw`
文件让数据在程序结束后继续存在。Python 可以读写文本和二进制文件；本节先掌握文本文件、路径和编码。可靠文件处理必须明确文件在哪里、以什么模式打开、使用什么编码，以及失败时如何处理。

## 使用 pathlib 管理路径

~~~python
from pathlib import Path

data_dir = Path("data")
file_path = data_dir / "values.txt"

print(file_path)
print(file_path.resolve())
print(file_path.suffix)
print(file_path.stem)
~~~

\`Path\` 使用除号运算符拼接路径，自动适配操作系统。不要用字符串加号手工拼接 \`"data/" + name\`。

创建目录：

~~~python
from pathlib import Path

output_dir = Path("output")
output_dir.mkdir(parents=True, exist_ok=True)
~~~

\`parents=True\` 允许创建缺失的父目录，\`exist_ok=True\` 表示目录已存在时不报错。

## 使用 with 打开文件

~~~python
from pathlib import Path

file_path = Path("message.txt")

with file_path.open("w", encoding="utf-8") as file:
    file.write("第一行\n")
    file.write("第二行\n")
~~~

\`with\` 代码块结束时会关闭文件，即使中途出现异常也能正确释放资源。写文本时明确指定 UTF-8，可以减少跨机器乱码。

读取全部文本：

~~~python
from pathlib import Path

content = Path("message.txt").read_text(encoding="utf-8")
print(content)
~~~

\`read_text()\` 适合较小文件。大文件不应一次全部载入内存。

## 文件模式

常用模式：

- \`"r"\`：读取，文件必须存在；
- \`"w"\`：写入，存在时清空原内容；
- \`"a"\`：追加到末尾；
- \`"x"\`：仅创建新文件，已存在则报错；
- 加 \`"b"\`：二进制模式，例如 \`"rb"\`。

追加日志：

~~~python
from datetime import datetime
from pathlib import Path

line = f"{datetime.now().isoformat()} program started\n"

with Path("run.log").open("a", encoding="utf-8") as file:
    file.write(line)
~~~

使用 \`"w"\` 会覆盖旧日志，必须根据需求选择。

## 逐行读取

~~~python
from pathlib import Path

with Path("values.txt").open("r", encoding="utf-8") as file:
    for line_number, line in enumerate(file, start=1):
        cleaned = line.strip()
        if not cleaned:
            continue
        print(line_number, cleaned)
~~~

文件对象本身可迭代，逐行读取不会把整个文件载入内存。\`.strip()\` 会清除两端空白；若空格有业务意义，只删除换行可使用 \`.rstrip("\n")\`。

## 写入多行

~~~python
from pathlib import Path

lines = ["case-A,12.5\n", "case-B,18.0\n"]

with Path("results.txt").open("w", encoding="utf-8") as file:
    file.writelines(lines)
~~~

\`.writelines()\` 不会自动添加换行，需要每项自带 \`\n\`。也可以先用 \`"\n".join()\` 组成文本：

~~~python
rows = ["case-A,12.5", "case-B,18.0"]
text = "\n".join(rows) + "\n"
Path("results.txt").write_text(text, encoding="utf-8")
~~~

## 检查文件与目录

~~~python
from pathlib import Path

path = Path("results.txt")

print(path.exists())
print(path.is_file())
print(path.is_dir())
print(path.stat().st_size if path.exists() else 0)
~~~

检查与使用之间文件仍可能被其他程序修改，因此关键操作仍要处理异常。

列出文件：

~~~python
from pathlib import Path

for path in Path(".").glob("*.txt"):
    print(path.name, path.stat().st_size)
~~~

\`rglob("*.txt")\` 会递归搜索子目录。扫描大量目录时应限制范围。

## 解析简单文本

假设 \`values.txt\` 内容：

~~~text
case-A,12.5
case-B,18.0
bad-line
case-C,9.6
~~~

解析代码：

~~~python
from pathlib import Path

records = []

with Path("values.txt").open(encoding="utf-8") as file:
    for line_number, line in enumerate(file, start=1):
        parts = line.strip().split(",")

        if len(parts) != 2:
            print(f"跳过第 {line_number} 行：字段数量错误")
            continue

        name, value_text = parts

        try:
            value = float(value_text)
        except ValueError:
            print(f"跳过第 {line_number} 行：数值无效")
            continue

        records.append((name, value))

print(records)
~~~

CSV 中若存在引号、逗号和换行，应使用标准库 \`csv\`，不能一直依赖 \`.split(",")\`。

## 编码问题

文本写入磁盘时必须转换为字节，读取时再从字节解码。写入与读取编码不一致就可能出现 \`UnicodeDecodeError\` 或乱码。

~~~python
text = "温度"
data = text.encode("utf-8")
restored = data.decode("utf-8")

print(data)
print(restored)
~~~

无法确定外部文件编码时，不要静默使用 \`errors="ignore"\`，它会丢失字符。应确认来源、记录检测结果或明确拒绝。

## 安全写入

重要文件可先写临时文件，再替换目标，减少中途失败造成半个文件的风险：

~~~python
from pathlib import Path

target = Path("config.txt")
temporary = target.with_suffix(".tmp")

temporary.write_text("timeout=30\n", encoding="utf-8")
temporary.replace(target)
~~~

## 本节要点

使用 \`Path\` 表达路径，使用 \`with\` 管理文件生命周期，明确模式与 UTF-8 编码，大文件逐行处理，解析失败应报告行号和原因。请创建一个文本文件保存五行“名称,数值”，编写程序读取有效行、计算平均值，并把错误行写入单独日志。

> 📝 **相关练习**：[ex-python-file-io-01] 读写文本文件并处理错误行
`,

  'error-handling': String.raw`
错误不是异常情况，而是程序运行的一部分。文件可能不存在，用户可能输入错误格式，网络可能中断。可靠程序应区分可以预期并处理的问题与必须暴露给开发者的缺陷。Python 使用异常对象描述错误，并通过回溯信息展示调用路径。

## 先学会阅读报错

~~~python
def divide(a, b):
    return a / b


result = divide(10, 0)
print(result)
~~~

最后一行通常是：

~~~text
ZeroDivisionError: division by zero
~~~

从下往上读：先看异常类型和说明，再查看最后一个属于自己代码的文件与行号，最后沿调用链理解数据如何到达那里。不要只复制整段错误去搜索而不看位置。

常见异常包括：

- \`SyntaxError\`：代码不符合语法，程序通常尚未正常开始；
- \`NameError\`：访问了不存在的名称；
- \`TypeError\`：对象类型不支持当前操作；
- \`ValueError\`：类型可接受，但具体值不合法；
- \`KeyError\`、\`IndexError\`：键或索引不存在；
- \`FileNotFoundError\`：目标文件不存在。

## 捕获可预期异常

~~~python
text = input("请输入数字：")

try:
    value = float(text)
except ValueError:
    print("输入不是有效数字")
else:
    print("两倍结果：", value * 2)
~~~

\`try\` 中只放可能失败的语句；\`except\` 处理指定异常；\`else\` 在没有异常时执行。范围越小，越不容易意外吞掉其他错误。

不要这样写：

~~~python
try:
    value = float(input("数字："))
    result = complex_calculation(value)
    save_result(result)
except Exception:
    print("出错了")
~~~

它把输入错误、算法缺陷和保存失败混为一谈，也丢失原始信息。

## 分别处理不同异常

~~~python
from pathlib import Path

try:
    text = Path("value.txt").read_text(encoding="utf-8")
    value = float(text.strip())
except FileNotFoundError:
    print("文件不存在")
except UnicodeDecodeError:
    print("文件不是 UTF-8 文本")
except ValueError:
    print("文件内容不是数字")
else:
    print("读取结果：", value)
~~~

处理方式不同就使用不同分支。多个异常处理相同，可写成元组：

~~~python
try:
    value = int("12.5")
except (TypeError, ValueError) as error:
    print(type(error).__name__, error)
~~~

\`as error\` 保留异常对象，可以记录具体说明。

## finally 保证清理

~~~python
file = None

try:
    file = open("data.txt", encoding="utf-8")
    print(file.read())
finally:
    if file is not None:
        file.close()
~~~

\`finally\` 无论是否异常都会执行，适合释放资源。文件操作优先使用 \`with\`，它已经封装了清理逻辑。

~~~python
from pathlib import Path

with Path("data.txt").open(encoding="utf-8") as file:
    print(file.read())
~~~

## 主动抛出异常

函数发现输入违反约定时，应立即 \`raise\`：

~~~python
def calculate_average(values):
    if not values:
        raise ValueError("values 不能为空")
    return sum(values) / len(values)


print(calculate_average([10, 20, 30]))
~~~

异常类型应表达问题类别。参数类型错误可使用 \`TypeError\`，值超出允许范围可使用 \`ValueError\`。

保留异常原因：

~~~python
def parse_positive_number(text):
    try:
        value = float(text)
    except ValueError as error:
        raise ValueError(f"无法解析数字：{text!r}") from error

    if value <= 0:
        raise ValueError("数值必须大于 0")

    return value
~~~

\`from error\` 建立异常链，既提供友好上下文，也保留底层原因。

## 自定义异常

较大程序可定义业务异常：

~~~python
class ConfigurationError(Exception):
    """配置内容无效。"""


def read_timeout(settings):
    if "timeout" not in settings:
        raise ConfigurationError("缺少 timeout")
    return settings["timeout"]
~~~

不要为每个小问题创建新异常。只有调用者确实需要单独捕获某类业务错误时才有价值。

## 记录而不是隐藏

~~~python
import logging

logging.basicConfig(level=logging.INFO)

try:
    value = float("not-a-number")
except ValueError:
    logging.exception("数值转换失败")
~~~

\`logging.exception()\` 在异常处理块中记录消息和回溯，适合排查无人值守程序。公开程序不应把敏感路径、凭据或私有数据原样显示给最终用户。

## 断言不是输入校验

~~~python
def normalize(value, maximum):
    assert maximum != 0
    return value / maximum
~~~

\`assert\` 适合检查开发阶段认为必然成立的内部条件，运行优化模式时可能被关闭。用户输入和关键业务规则应显式判断并抛出异常。

## 一个稳健解析例子

~~~python
def parse_values(lines):
    values = []
    errors = []

    for line_number, line in enumerate(lines, start=1):
        text = line.strip()

        if not text:
            continue

        try:
            value = float(text)
        except ValueError:
            errors.append((line_number, text))
            continue

        values.append(value)

    return values, errors


values, errors = parse_values(["12.5", "", "bad", "18.0"])
print(values)
print(errors)
~~~

这里跳过错误是明确设计，并把错误行返回给调用者，而不是静默丢失。

## 本节要点

异常处理的目标是恢复或提供上下文，不是让所有错误消失；优先捕获具体异常；缩小 \`try\` 范围；关键缺陷应继续抛出；清理资源优先使用上下文管理器。请为文件解析程序区分“不存在、编码错误、格式错误和空文件”，让每种情况产生不同且可追踪的结果。

> 📝 **相关练习**：[ex-python-error-handling-01] 为文件解析程序添加分层错误处理
`,
} as const;
