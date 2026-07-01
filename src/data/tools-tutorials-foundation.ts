export const foundationTutorials = {
  'python-intro': String.raw`
Python 是一门通用编程语言。所谓“编程语言”，可以理解为人与计算机之间的一套明确约定：人把处理步骤写成代码，Python 解释器读取代码并让计算机依次执行。学习 Python 的重点不是背单词，而是把一个问题拆成数据、步骤和结果。

## Python 程序如何工作

Python 源代码通常保存在扩展名为 \`.py\` 的文本文件中。文件本身不能直接完成计算，真正执行代码的是 Python 解释器。解释器从上到下读取语句，遇到函数调用或流程控制时再按照相应规则运行。

下面只有一行代码。它调用内置函数 \`print()\`，把括号中的文本输出到终端：

~~~python
print("你好，Python")
~~~

运行结果：

~~~text
你好，Python
~~~

代码中的英文双引号用来表示文本。括号表示把这个文本交给 \`print()\`。即使暂时不理解“函数”，也可以先记住：代码中的符号都有明确含义，不能随意省略。

Python 也可以直接计算：

~~~python
length = 2.4
width = 1.5
area = length * width
print(area)
~~~

运行结果是 \`3.5999999999999996\` 或接近 3.6 的数字。这里顺便暴露了一个重要事实：计算机中的浮点数是近似表示，后续学习数值类型时会详细解释。

## Python 的特点

Python 语法接近自然语言，代码通常比 C、Java 等语言短。它自带大量标准库，也能安装 NumPy、Pandas、Matplotlib 等第三方库。标准库随 Python 一起安装；第三方库需要另外安装。两者都可以通过 \`import\` 使用。

~~~python
from math import sqrt

diagonal = sqrt(3 ** 2 + 4 ** 2)
print(diagonal)
~~~

这里从标准库 \`math\` 中导入平方根函数。运行结果为 \`5.0\`。你不需要自己编写开平方算法，只需正确调用已有能力。

Python 是动态类型语言。创建变量时不必先声明它是整数还是文本，解释器会根据赋值对象判断类型：

~~~python
count = 12
name = "case-A"
finished = True

print(type(count))
print(type(name))
print(type(finished))
~~~

输出会分别显示 \`int\`、\`str\` 和 \`bool\`。动态类型让入门更容易，但也要求编写者主动检查输入，避免把文本误当成数字。

## Python 适合做什么

Python 擅长数据处理、自动化、科学计算、绘图、Web 服务和测试。一个重复操作只要规则明确，通常就可以写成程序。例如批量重命名文件、读取 CSV、筛选异常数据、生成图表，或者把一组参数依次交给其他软件。

它并不适合所有任务。对极端实时、底层硬件或计算性能要求很高的部分，C/C++、Fortran 等语言可能更合适。工程项目常见的做法是：底层高性能库负责密集计算，Python 负责组织数据、调用库和串联流程。

## 学习时真正要掌握什么

不要把学习目标定成“记住全部语法”。更有效的目标是：

- 能看懂变量中保存了什么；
- 能把大问题拆成几个可验证的小步骤；
- 遇到错误时会阅读最后一段报错信息；
- 能修改示例并预测结果如何变化；
- 不确定时会查询官方文档或在最小代码中试验。

试着修改下面程序中的数值和文字，再观察输出：

~~~python
project = "基础练习"
steps = 3
minutes_per_step = 15
total_minutes = steps * minutes_per_step

print(project)
print("预计用时：", total_minutes, "分钟")
~~~

如果你能说明每个变量保存的内容，并能在不复制新代码的情况下改变计算结果，就已经完成了本节最重要的练习。

## 本节要点

Python 源文件是文本，解释器负责执行；程序由数据和处理步骤组成；\`print()\` 用于输出；库可以复用已有能力。后面的课程会从安装环境开始，逐步学习变量、数据类型、流程控制、数据结构和函数。每学一个概念，都应亲自运行、修改并解释示例，而不是只浏览页面。

> 📝 **相关练习**：[ex-python-intro-01] 用 print 和变量编写自我介绍程序
	`,

  'python-install': String.raw`
写 Python 代码至少需要两个工具：Python 解释器和代码编辑器。解释器负责运行代码，编辑器负责创建和修改文件。本教程以 Windows 为主，推荐安装官方 Python 3 和 Visual Studio Code；macOS 与 Linux 的命令基本相同，但安装入口不同。

## 安装 Python

在 Python 官方网站下载安装程序。Windows 安装界面中应勾选“Add Python to PATH”，它会把解释器路径加入环境变量，使终端能够找到 \`python\` 命令。安装完成后重新打开 PowerShell，执行：

~~~powershell
python --version
~~~

正常情况下会看到类似：

~~~text
Python 3.x.x
~~~

版本号会随时间变化，重点不是必须等于某个具体小版本，而是命令能够返回 Python 3。如果提示找不到命令，先尝试：

~~~powershell
py --version
~~~

Windows 的 \`py\` 是 Python Launcher，可在一台机器上选择不同 Python 版本。若 \`py\` 可用而 \`python\` 不可用，通常是 PATH 没有配置正确，不代表安装文件一定损坏。

## 确认解释器位置

仅看到版本号还不够。下面命令会打印当前正在使用的解释器路径：

~~~powershell
python -c "import sys; print(sys.executable)"
~~~

如果机器上装过 Anaconda、Microsoft Store Python 或旧版本，这一步尤其重要。终端、VS Code 和后续虚拟环境应指向你预期的解释器，否则容易出现“终端能导入，编辑器却报错”的情况。

还可以运行一个最小计算：

~~~powershell
python -c "print(6 * 7)"
~~~

看到 \`42\` 说明解释器不但能被找到，也确实执行了代码。

## 安装并配置 VS Code

安装 Visual Studio Code 后，在扩展商店安装 Microsoft 发布的 Python 扩展。创建一个空文件夹，例如 \`python-study\`，用 VS Code 打开该文件夹，再新建 \`hello.py\`：

~~~python
print("环境配置完成")
~~~

按 \`Ctrl+Shift+P\`，输入“Python: Select Interpreter”，选择前面检查过的解释器。右上角运行按钮可以执行当前文件；也可以打开 VS Code 终端并输入：

~~~powershell
python hello.py
~~~

两种方式都应输出同一句话。如果运行按钮与终端结果不同，首先检查 VS Code 右下角显示的解释器。

## 认识 pip

\`pip\` 是 Python 的包安装工具。先检查它是否属于当前解释器：

~~~powershell
python -m pip --version
~~~

推荐使用 \`python -m pip\` 而不是单独输入 \`pip\`。前者明确表示“使用当前这个 Python 的 pip”，在多版本环境中更不容易装错位置。

本课程前半部分只依赖标准库，不需要急着安装大量软件包。可以用下面命令查看当前环境已有的包：

~~~powershell
python -m pip list
~~~

不要为了“以后可能会用”一次性安装几十个包。依赖越多，版本冲突和环境复现的成本越高。

## 常见问题

终端提示 \`python is not recognized\` 时，通常是 PATH 未生效。先关闭并重新打开终端；仍无效再检查安装目录或重新运行安装程序。Microsoft Store 弹出而没有执行真实 Python，可能是 Windows 的应用执行别名拦截了命令，可在系统设置中关闭相应别名。

出现多个解释器时不要随意删除。先记录每个解释器的路径，确认项目实际使用哪一个，再处理旧环境。直接删除目录可能让已有项目或软件失效。

macOS 常用 \`python3\` 而不是 \`python\`；Linux 发行版通常已经提供 Python 3，但系统 Python 可能被操作系统工具依赖，不应随意覆盖。

## 完成检查

依次运行下面三条命令：

~~~powershell
python --version
python -c "import sys; print(sys.executable)"
python -m pip --version
~~~

然后在 VS Code 中运行 \`hello.py\`。四项都成功，才算环境配置完成。以后遇到\u201c包找不到\u201d或\u201c版本不一致\u201d，也应先回到这三条命令，确认自己究竟在使用哪个解释器。

> \u{1f4dd} **\u76f8\u5173\u7ec3\u4e60**：[ex-python-install-01] \u5b8c\u6210\u73af\u5883\u914d\u7f6e\u5e76\u8bb0\u5f55\u89e3\u91ca\u5668\u4fe1\u606f
`,

  'first-program': String.raw`
第一个程序不应该只停留在一句“Hello World”。这一节会走完创建文件、运行代码、观察输出、修改程序和阅读错误的完整流程。完成后，你应能独立建立一个简单项目，而不是依赖编辑器中的神秘按钮。

## 创建程序文件

新建文件夹 \`python-study\`，在其中创建 \`first_program.py\`。文件名建议只使用英文字母、数字和下划线，不要以数字开头，也不要把文件命名为 \`random.py\`、\`json.py\` 等标准库名称。

写入：

~~~python
print("这是我的第一个 Python 程序")
print(2 + 3)
~~~

保存文件，在该文件夹中打开终端：

~~~powershell
python first_program.py
~~~

终端会输出一行文字和数字 \`5\`。Python 从第一行开始执行，完成后继续第二行。程序执行完毕，控制权返回终端。

## 让程序保存数据

把代码改为：

~~~python
course_name = "Python 基础"
lesson_number = 1
completed = True

print(course_name)
print("当前课次：", lesson_number)
print("是否完成：", completed)
~~~

\`course_name\`、\`lesson_number\` 和 \`completed\` 是变量。等号右边的值先被创建，再由左边的名字引用。变量使代码不必在多个位置重复写相同内容。

可以继续计算：

~~~python
minutes_each_day = 30
days = 7
total_minutes = minutes_each_day * days

print("一周学习时间：", total_minutes, "分钟")
~~~

把 \`days\` 改为 10，只有最后的计算结果会随之变化。程序的价值就在这里：规则写一次，输入变化时重复执行。

## 脚本模式与交互模式

在终端直接输入 \`python\` 会进入交互式解释器，提示符通常为 \`>>>\`：

~~~text
>>> 10 / 4
2.5
>>> "py" * 3
'pypypy'
~~~

交互模式适合快速试验一个表达式或检查对象。输入 \`exit()\` 可以退出。正式学习和可重复任务应写进 \`.py\` 文件，因为文件可以保存、比较和再次运行。

不要把交互模式中的 \`>>>\` 一起写进程序文件。它是解释器提示符，不是 Python 语法。

## 读懂第一类错误

故意删除字符串末尾的引号：

~~~python-error
print("缺少右侧引号)
~~~

运行后会看到 \`SyntaxError\`。报错通常包含文件名、行号、出错代码和错误类型。阅读时先看最后一行，再回到箭头所指位置。语法错误表示代码不符合书写规则，解释器甚至无法开始正常执行。

再试一个运行时错误：

~~~python
total = 100
parts = 0
print(total / parts)
~~~

这段代码语法正确，但运行到除法时出现 \`ZeroDivisionError\`。这说明“能启动”不等于“逻辑正确”。以后排错时要区分语法错误、运行时异常和结果不符合预期三类问题。

## 使用主入口

较完整的脚本常把主要步骤放进 \`main()\`：

~~~python
def main():
    name = "学习者"
    print("你好，", name)
    print("程序执行完成")


if __name__ == "__main__":
    main()
~~~

现在不必完全理解函数和 \`__name__\`。先知道这种写法能清楚标记程序入口，后续把文件作为模块导入时也不会自动执行主流程。

## 一个完整的小程序

~~~python
def main():
    width = 4.0
    height = 2.5
    area = width * height

    print("矩形宽度：", width)
    print("矩形高度：", height)
    print("矩形面积：", area)


if __name__ == "__main__":
    main()
~~~

请分别修改宽度和高度，预测输出后再运行。然后故意把一个变量名拼错，观察 \`NameError\` 指向哪里。会运行程序只是第一步；能预测、修改并解释结果，才表示真正理解。

> 📝 **相关练习**：[ex-python-first-01] 创建完整小程序并排错
	`,

  'syntax-basics': String.raw`
Python 的代码外观很简洁，但书写规则非常严格。注释说明意图，缩进表示代码层级，换行通常表示一条语句结束。初学者遇到的大量错误都与这三件事有关，因此值得在学习复杂语法前彻底弄清。

## 注释写给人看

井号 \`#\` 后面的内容是单行注释，解释器不会执行：

~~~python
# 计算矩形面积
width = 3.0
height = 2.0
area = width * height  # 单位：平方米
print(area)
~~~

好注释解释“为什么这样做”或补充单位、来源和限制，而不是重复代码。下面的注释几乎没有价值：

~~~python
count = count + 1  # count 加 1
~~~

更有用的写法是：

~~~python
# 跳过表头后，数据行编号从 1 开始
count = count + 1
~~~

三引号字符串经常被误称为“多行注释”。它本质上仍是字符串。放在模块、函数或类开头时可作为文档字符串，被 \`help()\` 等工具读取。

~~~python
def square(value):
    """返回 value 的平方。"""
    return value * value


print(square(5))
print(square.__doc__)
~~~

## 缩进就是代码结构

Python 用缩进表示哪些语句属于同一个代码块：

~~~python
temperature = 38

if temperature > 35:
    print("温度较高")
    print("建议检查散热")

print("检查结束")
~~~

前两个输出语句缩进相同，都属于 \`if\`。最后一行没有缩进，因此无论条件真假都会执行。

标准风格使用 4 个空格缩进。不要混用 Tab 和空格，也不要为了“看起来更整齐”随意改变缩进。编辑器可以显示空白字符，出现 \`IndentationError\` 或 \`TabError\` 时应先检查缩进。

比较下面两段代码：

~~~python
score = 85

if score >= 60:
    print("合格")
    if score >= 90:
        print("优秀")
~~~

~~~python
score = 85

if score >= 60:
    print("合格")

if score >= 90:
    print("优秀")
~~~

第一段的第二个判断位于第一个判断内部；第二段是两个独立判断。虽然本例结果相同，边界条件变化后执行逻辑可能不同。

## 一行写一件清楚的事

Python 通常以换行结束语句。分号可以把多条语句写在一行，但会降低可读性：

~~~python
# 能运行，但不推荐
x = 1; y = 2; print(x + y)
~~~

推荐：

~~~python
x = 1
y = 2
print(x + y)
~~~

一条表达式过长时，可在圆括号、方括号或花括号内自然换行：

~~~python
total = (
    12.5
    + 8.3
    + 4.2
)
print(total)
~~~

这种方式比行末反斜杠更稳妥，也便于增删内容。

## 标识符和关键字

变量、函数和类的名字统称标识符。标识符可以包含字母、数字和下划线，但不能以数字开头，也不能使用 Python 关键字。

~~~python
project_name = "demo"   # 合法
case_01 = 120           # 合法
_cache = {}             # 合法，但前导下划线通常表示内部使用
~~~

\`if\`、\`for\`、\`class\`、\`True\` 等是关键字。可以查看当前版本的完整列表：

~~~python
import keyword

print(keyword.kwlist)
print(keyword.iskeyword("for"))
print(keyword.iskeyword("project"))
~~~

## 空行与代码布局

空行不改变程序逻辑，却能划分段落。一般在顶层函数之间留两个空行，在函数内部不同逻辑步骤之间留一个空行。不要把几十行代码挤成一块，也不要每行之间都插入空行。

下面的结构容易阅读：

~~~python
def calculate_area(width, height):
    """计算矩形面积。"""
    return width * height


width = 3.0
height = 2.0
area = calculate_area(width, height)

print("面积：", area)
~~~

## 本节检查

看到一段 Python 代码时，先观察缩进层级，再找关键字和括号，最后逐行判断执行顺序。请把条件示例中的温度改为 30，先预测哪些行会输出，再运行验证。然后故意多缩进或少缩进一行，阅读解释器给出的错误位置。清晰的布局不是装饰，它直接决定代码是否正确、是否容易复查。

> 📝 **相关练习**：[ex-python-syntax-01] 判断缩进结构与执行结果
`,

  'variables-and-naming': String.raw`
变量是代码中最常用的概念。初学时可以把变量理解为“给一个对象起名字”，但不要把它想成永远固定的盒子。Python 先创建值对象，再让变量名指向对象；重新赋值只是改变这个名字的指向。

## 赋值的执行顺序

~~~python
length = 2.5
width = 1.2
area = length * width

print(area)
~~~

等号 \`=\` 是赋值符号，不是数学中的恒等关系。解释器先计算右侧 \`length * width\`，再把结果交给左侧名字 \`area\`。

变量可以重新赋值：

~~~python
status = "等待"
print(status)

status = "完成"
print(status)
~~~

同一个名字先后指向两个不同字符串。前一个字符串不会因此被“修改”；只是 \`status\` 不再引用它。

## 多个名字可能引用同一对象

~~~python
a = [1, 2, 3]
b = a
b.append(4)

print(a)
print(b)
~~~

两行都会输出 \`[1, 2, 3, 4]\`，因为 \`a\` 和 \`b\` 引用同一个列表。若需要独立副本，应显式复制：

~~~python
a = [1, 2, 3]
b = a.copy()
b.append(4)

print(a)
print(b)
~~~

数字和字符串是不可变对象，表现会有所不同：

~~~python
a = 10
b = a
a = 20

print(a)
print(b)
~~~

\`a = 20\` 让 \`a\` 指向新整数，并没有改变整数 10，因此 \`b\` 仍然是 10。理解“名字引用对象”可以解释很多看似奇怪的行为。

## 清楚的命名比短命名更重要

Python 通常使用小写字母和下划线命名变量：

~~~python
node_count = 120
maximum_temperature = 86.5
result_file_path = "results/output.txt"
~~~

\`n\`、\`x1\`、\`tmp\` 在很短的局部计算中可以接受，但长期代码应表达含义。名称不必把所有背景都写进去，也不能模糊到只有作者自己理解。

布尔变量适合使用 \`is_\`、\`has_\`、\`can_\` 等前缀：

~~~python
is_converged = True
has_warning = False
can_export = is_converged and not has_warning

print(can_export)
~~~

常量没有语法上的强制限制，社区约定使用全大写名称：

~~~python
SECONDS_PER_MINUTE = 60
DEFAULT_TIMEOUT = 30
~~~

这表示“代码运行期间不应修改”，是给阅读者和工具看的约定。

## 同时赋值与拆包

Python 可以一次给多个变量赋值：

~~~python
x, y, z = 1.0, 2.0, 3.0
print(x, y, z)
~~~

还可以交换两个变量，不需要临时变量：

~~~python
left = "A"
right = "B"
left, right = right, left

print(left, right)
~~~

右侧先整体计算为一组值，再分别赋给左侧名字。左右数量不一致会触发 \`ValueError\`。

## 删除名字与检查对象

\`del\` 可以删除变量名：

~~~python
temporary_value = 42
print(temporary_value)

del temporary_value
~~~

删除后再次访问会出现 \`NameError\`。日常代码很少需要主动删除普通变量；让变量只存在于较小的函数作用域通常更清楚。

可以使用 \`id()\` 查看对象在当前运行过程中的身份标识：

~~~python
items = [1, 2]
same_items = items
copied_items = items.copy()

print(id(items) == id(same_items))
print(id(items) == id(copied_items))
~~~

结果为 \`True\` 和 \`False\`，再次说明引用与复制不同。

## 常见命名问题

不要覆盖内置函数名：

~~~python
# 不推荐：之后无法正常调用 list()
list = [1, 2, 3]
~~~

也不要使用难以区分的单字母，例如小写 \`l\`、大写 \`O\`。名称应与单位和含义一致：若 \`length_mm\` 保存毫米，后续就不要悄悄改存米。

最后运行下面代码，并解释每一步：

~~~python
original = {"name": "case-1"}
alias = original
copy_data = original.copy()

alias["name"] = "case-2"

print(original)
print(alias)
print(copy_data)
~~~

能够判断三个字典的输出，并说明为什么不同，就掌握了变量、引用和复制的核心。后续学习列表、字典和函数参数时，这个模型会反复用到。

> 📝 **相关练习**：[ex-python-variables-01] 区分引用与复制
`,
} as const;
