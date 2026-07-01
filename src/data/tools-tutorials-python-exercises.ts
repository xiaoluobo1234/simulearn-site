// Python 练习题库 —— 为 20 篇 Python 教程设计的练习系统
// 每题包含题目、提示、参考答案。引用方式与 APDL 练习一致：[ex-python-xxx-01]

export interface PythonExercise {
  id: string;
  title: string;
  description: string;
  hints: string[];
  answer: string;
  relatedTutorials: string[];
}

export const pythonExercises: PythonExercise[] = [
  // ==========================================
  // 基础入门（对应 foundation 模块）
  // ==========================================

  {
    id: 'ex-python-intro-01',
    title: '用 print 和变量编写自我介绍程序',
    description: '编写一个 Python 程序，用一个变量保存你的学习目标，用另一个变量保存你预估的每周学习时长（小时），然后用 print 输出一段清晰的话：既包含目标，也包含预估时长。修改时长变量并再次运行，确认输出随之变化。',
    hints: [
      '变量在 print 中可以用逗号分隔多个参数',
      '也可以使用 f-string：f"我叫{name}，目标是{goal}"',
      '修改值后重新运行即可看到不同输出',
    ],
    answer: 'goal = "掌握 Python 基础语法"\nhours_per_week = 5\n\nprint("我的学习目标：", goal)\nprint("每周学习时长：", hours_per_week, "小时")\n\n# 修改 hours_per_week = 8 后再运行',
    relatedTutorials: ['python-intro'],
  },

  {
    id: 'ex-python-install-01',
    title: '完成环境配置并记录解释器信息',
    description: '在你的计算机上完成 Python + VS Code 环境配置。依次执行以下命令并记录输出：(1) python --version；(2) python -c "import sys; print(sys.executable)"；(3) python -m pip --version。在 VS Code 中创建并运行 hello.py。全部通过后写出每一条命令的输出结果。',
    hints: [
      'Windows 用户注意勾选"Add Python to PATH"',
      '如果 python 命令不识别，先用 py --version 测试',
      'VS Code 右下角显示的解释器应与命令行的 sys.executable 一致',
    ],
    answer: 'python --version → Python 3.x.x\npython -c "import sys; print(sys.executable)" → C:\\Users\\...\\python.exe\npython -m pip --version → pip 2x.x from ...\nhello.py 运行成功 → "环境配置完成" 显示在终端',
    relatedTutorials: ['python-install'],
  },

  {
    id: 'ex-python-first-01',
    title: '创建完整小程序并排错',
    description: '创建一个文件 my_first.py，包含 main() 函数和 if __name__ == "__main__" 入口。程序计算矩形面积（width=3.5, height=2.0），输出宽度、高度和面积。然后故意制造三个错误分别运行：① 拼错变量名（NameError）；② 删除一个引号（SyntaxError）；③ 除以 0（ZeroDivisionError）。记录每个错误的最后一行报错信息和行号。',
    hints: [
      'def main(): 定义函数，缩进 4 个空格',
      'if __name__ == "__main__": 注意是双下划线',
      '阅读报错时从最后一行向上找自己代码中的行号',
    ],
    answer: 'def main():\n    width = 3.5\n    height = 2.0\n    area = width * height\n    print("宽度：", width)\n    print("高度：", height)\n    print("面积：", area)\n\nif __name__ == "__main__":\n    main()\n\n错误①：把 area 拼成 are → NameError: name \'are\' is not defined\n错误②：删除 "面积：" 右边的引号 → SyntaxError: unterminated string literal\n错误③：添加 print(width / 0) → ZeroDivisionError: division by zero',
    relatedTutorials: ['first-program'],
  },

  {
    id: 'ex-python-syntax-01',
    title: '判断缩进结构与执行结果',
    description: '下面两组代码分别会产生什么输出？在纸上画出每行所属的代码块，预测结果后再运行验证。\n\n代码 A：\nscore = 72\nif score >= 60:\n    print("及格")\n    if score >= 80:\n        print("良好")\nprint("结束")\n\n代码 B：\nscore = 72\nif score >= 60:\n    print("及格")\n\nif score >= 80:\n    print("良好")\nprint("结束")',
    hints: [
      '缩进相同的语句属于同一代码块',
      '代码 A 中第二个 if 在第一个 if 内部',
      '代码 B 中两个 if 是独立判断',
    ],
    answer: '代码 A 输出：及格 → 结束。第二个 if 嵌套在第一个 if 内部，72 >= 80 为 False 所以不执行。\n代码 B 输出：及格 → 结束。两个 if 独立判断，72 >= 80 为 False 不输出"良好"。\n本题的 72 分时结果相同，但 85 分时 A 会输出"及格、良好、结束"，B 只输出"及格、结束"。',
    relatedTutorials: ['syntax-basics'],
  },

  {
    id: 'ex-python-variables-01',
    title: '区分引用与复制',
    description: '写出以下代码的输出，并解释每一步为什么得到该结果：\n\noriginal = {"name": "case-1"}\nalias = original\ncopy_data = original.copy()\nalias["name"] = "case-2"\nprint(original)\nprint(alias)\nprint(copy_data)\n\n然后再用列表 [1, 2, 3] 做同样的实验，写出结论。',
    hints: [
      '= 赋值创建了新的引用（别名），不复制对象',
      '.copy() 创建浅复制——一个新的独立对象',
      '字典是可变的，通过别名修改会反映在原对象上',
    ],
    answer: '输出：\n{\'name\': \'case-2\'}  # original 被 alias 的修改影响\n{\'name\': \'case-2\'}  # alias 和 original 引用同一对象\n{\'name\': \'case-1\'}  # copy_data 是独立副本，不受影响\n\n列表实验：\na = [1, 2, 3]; b = a; c = a.copy()\na.append(4) → a 和 b 都是 [1,2,3,4]，c 是 [1,2,3]\n\n核心结论：赋值不复制，copy() 创建浅复制。',
    relatedTutorials: ['variables-and-naming'],
  },

  // ==========================================
  // 语言基础（对应 language 模块）
  // ==========================================

  {
    id: 'ex-python-input-output-01',
    title: '编写物品记录输入输出程序',
    description: '编写一个程序：依次让用户输入物品名称、单价、数量，使用 f-string 格式化输出一个对齐的小表格。要求：(1) 名称左对齐占 10 位，(2) 单价右对齐占 8 位保留 1 位小数，(3) 数量右对齐占 6 位，(4) 合计金额右对齐占 10 位保留 2 位小数。用 sep 和 end 参数美化输出分隔线。',
    hints: [
      'input() 返回字符串，需要用 float() 或 int() 转换',
      'f"{name:<10}" 表示左对齐、占 10 个字符',
      'print("=" * 30) 可以打印分隔线',
    ],
    answer: 'name = input("物品名称：").strip()\nprice = float(input("单价："))\nquantity = int(input("数量："))\ntotal = price * quantity\n\nprint("=" * 36)\nprint(f"{\'物品\':<10}{\'单价\':>8}{\'数量\':>6}{\'合计\':>10}")\nprint("-" * 36)\nprint(f"{name:<10}{price:>8.1f}{quantity:>6}{total:>10.2f}")\nprint("=" * 36)',
    relatedTutorials: ['input-output'],
  },

  {
    id: 'ex-python-numbers-01',
    title: '用浮点容差验证计算结果',
    description: '计算以下表达式并判断结果：(1) 0.1 + 0.2 == 0.3；(2) 7 // 3 与 -7 // 3 的值；(3) float("inf") > 1e308 的结果。然后用 math.isclose() 重新判断 (1)，设置 rel_tol=1e-9。解释三个问题的原因。',
    hints: [
      '浮点数 0.1 和 0.2 在二进制中是无限循环小数',
      '// 是向下取整，不是向零截断',
      'inf 表示无穷大，任何有限数值都小于它',
    ],
    answer: '(1) 0.1 + 0.2 结果是 0.30000000000000004，不等于 0.3 → False\n    用 isclose(0.1+0.2, 0.3) → True，因为相对差异小于 1e-9\n(2) 7 // 3 = 2，-7 // 3 = -3（向负无穷取整）\n(3) True，inf 大于任何有限数\n\n结论：浮点比较必须用容差，// 注意负数方向。',
    relatedTutorials: ['numbers-booleans-none'],
  },

  {
    id: 'ex-python-strings-01',
    title: '解析传感器数据字符串',
    description: '原始字符串为 "point-12: 86.5 C"。使用字符串方法解析出三个部分：(1) 点位名称（"point-12"），(2) 数值（86.5 转为 float），(3) 单位（"C"）。写出完整代码，并说明每一步返回的数据类型。',
    hints: [
      '先用 .strip() 清理，再用 .split(":") 分割名称和右侧',
      '右侧部分用 .strip().split() 分离数字和单位',
      '数值字符串转 float 时不需要单位',
    ],
    answer: 'raw = "point-12: 86.5 C"\n# 分割名称和右侧\nname_part, right = raw.strip().split(":")\nname = name_part.strip()  # str: "point-12"\n# 分割数值和单位\nvalue_text, unit = right.strip().split()\nvalue = float(value_text)  # float: 86.5\n\nprint(f"名称={name}, 数值={value}, 单位={unit}")\n\n步骤中 split 返回 list，索引访问返回 str，float() 返回 float。',
    relatedTutorials: ['strings-basics'],
  },

  {
    id: 'ex-python-type-conversion-01',
    title: '编写安全解析函数',
    description: '编写一个函数 parse_value_raw(text)，输入一个字符串（可能带前后空格和单位），尝试解析出数值。要求：(1) 去掉空格；(2) 从右往左分离非数字单位（如 " kg"、" MPa"）；(3) 尝试 float 转换；(4) 转换失败时返回 None 而不是崩溃；(5) 测试 " 18.5 kg "、"125.4 MPa"、"invalid" 和 "" 四种输入。',
    hints: [
      '可以先去掉所有空格，再从右往左找第一个非数字/非小数点的字符',
      '也可以用 try/except 处理 float 转换失败',
      '返回 None 让调用者自行决定如何处理缺失值',
    ],
    answer: 'def parse_value_raw(text):\n    if not text:\n        return None\n    cleaned = text.strip()\n    # 从右往左找单位分隔位置\n    for i in range(len(cleaned) - 1, -1, -1):\n        ch = cleaned[i]\n        if ch.isdigit() or ch == \'.\' or ch == \'-\':\n            continue\n        # 找到非数字字符，尝试解析前面的数字部分\n        try:\n            return float(cleaned[:i+1].rstrip())\n        except ValueError:\n            return None\n    # 全是数字部分\n    try:\n        return float(cleaned)\n    except ValueError:\n        return None\n\nprint(parse_value_raw(" 18.5 kg "))   # 18.5\nprint(parse_value_raw("invalid"))     # None\nprint(parse_value_raw(""))            # None\nprint(parse_value_raw("125.4 MPa"))   # 125.4',
    relatedTutorials: ['type-conversion'],
  },

  {
    id: 'ex-python-operators-01',
    title: '用逻辑短路安全读取列表',
    description: '给定一个可能为空的列表 items，编写代码安全地判断"第一个元素大于 0"。要求使用逻辑短路避免 IndexError，并测试 items=[]、items=[5, -2]、items=[-1, 10] 三种情况。再写一段代码使用 or 运算符为可能为空的 name 变量提供默认值 "未命名"。',
    hints: [
      'items and items[0] > 0 — 空列表为假值，and 短路不执行右侧',
      'or 返回第一个真值，或最后一个假值',
      '注意 0 和空字符串也是假值',
    ],
    answer: '# 安全判断第一个元素\nitems_empty = []\nitems_positive = [5, -2]\nitems_negative = [-1, 10]\n\nfor items in [items_empty, items_positive, items_negative]:\n    if items and items[0] > 0:\n        print(f"第一个元素 {items[0]} 为正数")\n    else:\n        print("列表为空或首元素非正")\n\n# 提供默认值\nname = ""\ndisplay = name or "未命名"\nprint(display)  # "未命名"\n\nname = "case-A"\ndisplay = name or "未命名"\nprint(display)  # "case-A"',
    relatedTutorials: ['basic-operators'],
  },

  // ==========================================
  // 控制流程（对应 control 模块）
  // ==========================================

  {
    id: 'ex-python-control-flow-01',
    title: '编写分数等级判断并验证边界',
    description: '编写一个程序：输入 0-100 的分数，输出等级 A(≥90)、B(≥80)、C(≥60)、D(<60)。先画条件顺序，然后依次测试 -1、0、59、60、89、90、100 七个边界值，确认每个值落入正确的等级且没有遗漏或重叠。',
    hints: [
      '判断顺序应从高到低：先 ≥90，再 ≥80，再 ≥60',
      '如果先写 ≥60，89 分会被错误地判为 C',
      '边界值 0 应属于 D，100 应属于 A',
    ],
    answer: 'score = int(input("请输入分数："))\nif score >= 90:\n    grade = "A"\nelif score >= 80:\n    grade = "B"\nelif score >= 60:\n    grade = "C"\nelse:\n    grade = "D"\nprint(f"等级：{grade}")\n\n测试结果：-1→D, 0→D, 59→D, 60→C, 89→B, 90→A, 100→A',
    relatedTutorials: ['control-flow-if'],
  },

  {
    id: 'ex-python-loops-01',
    title: '编写遍历统计与提前终止程序',
    description: '编写一个程序：遍历 1 到 100 的整数，(1) 统计能被 3 整除的数字个数，(2) 遇到第一个大于 80 且能被 7 整除的数字时停止循环并输出该数字。要求先画出循环变量、判断条件和终止逻辑，再写代码。',
    hints: [
      'for num in range(1, 101) 生成 1 到 100',
      '能被 3 整除：num % 3 == 0',
      '遇到终止条件时用 break 跳出循环',
    ],
    answer: 'count_div3 = 0\nfor num in range(1, 101):\n    # (2) 先检查终止条件\n    if num > 80 and num % 7 == 0:\n        print(f"终止数字：{num}")\n        break\n    # (1) 统计能被 3 整除的数\n    if num % 3 == 0:\n        count_div3 += 1\n\nprint(f"能被 3 整除的个数：{count_div3}")\n\n结果：终止数字是 84（第一个 >80 且被 7 整除），\n统计到 83 为止，能被 3 整除的有 27 个（3,6,...,81）。',
    relatedTutorials: ['loops-for-while'],
  },

  // ==========================================
  // 数据结构（对应 structure 模块）
  // ==========================================

  {
    id: 'ex-python-lists-01',
    title: '清理数据列表并计算统计值',
    description: '给定数据 raw = [12.5, None, -1.0, 18.2, None, 9.8, 21.0, -0.5]，完成以下处理：(1) 过滤掉 None 和负数，(2) 将有效值从小到大排序，(3) 去掉排序后的第一个和最后一个（极值），(4) 计算剩余值的平均值。输出每一步的中间结果。',
    hints: [
      '用列表推导式过滤：[v for v in raw if v is not None and v >= 0]',
      'sorted() 返回新列表，不修改原列表',
      '用切片去掉首尾：[1:-1]',
    ],
    answer: 'raw = [12.5, None, -1.0, 18.2, None, 9.8, 21.0, -0.5]\n\n# (1) 过滤\nvalid = [v for v in raw if v is not None and v >= 0]\nprint("有效值：", valid)  # [12.5, 18.2, 9.8, 21.0]\n\n# (2) 排序\nsorted_valid = sorted(valid)\nprint("排序后：", sorted_valid)  # [9.8, 12.5, 18.2, 21.0]\n\n# (3) 去极值\nif len(sorted_valid) >= 3:\n    trimmed = sorted_valid[1:-1]\nelse:\n    trimmed = sorted_valid\nprint("去极值：", trimmed)  # [12.5, 18.2]\n\n# (4) 平均值\naverage = sum(trimmed) / len(trimmed)\nprint(f"平均值：{average:.2f}")  # 15.35',
    relatedTutorials: ['lists'],
  },

  {
    id: 'ex-python-tuples-01',
    title: '用元组拆包处理多项返回',
    description: '编写一个函数 analyze_numbers(values)，接收一组数字，返回一个元组包含 (数量, 最小值, 最大值, 平均值)。调用该函数并用拆包一次性接收四个值。说明为什么这里用元组比列表更合适。',
    hints: [
      'return len(v), min(v), max(v), sum(v)/len(v) 实际返回元组',
      '拆包时左右数量要一致',
      '元组表示"固定结构"，列表表示"可变容器"',
    ],
    answer: 'def analyze_numbers(values):\n    if not values:\n        raise ValueError("数值列表不能为空")\n    return len(values), min(values), max(values), sum(values) / len(values)\n\ndata = [12.5, 18.0, 9.6, 21.0]\ncount, minimum, maximum, average = analyze_numbers(data)\n\nprint(f"数量={count}, 最小={minimum}, 最大={maximum}, 平均={average:.2f}")\n\n# 用元组的原因：函数返回的四个值构成一个固定记录，\n# 调用者不应添加或删除字段。元组的不可变性正好表达这一意图。',
    relatedTutorials: ['tuples'],
  },

  {
    id: 'ex-python-dicts-01',
    title: '设计课程字典并检查必填字段',
    description: '设计一个"课程"字典，包含以下字段：title（标题）、lesson_number（课次）、completed（是否完成）、tags（标签列表）。然后编写一段代码：(1) 检查 title、lesson_number、completed 三个必填字段是否存在且类型正确；(2) 遍历输出所有键值对。测试一个完整字典和一个缺少 title 的字典。',
    hints: [
      '用 key in dict 判断键是否存在',
      'isinstance(value, type) 检查值的类型',
      'for key, value in dict.items() 遍历所有键值对',
    ],
    answer: 'def validate_course(course):\n    required = {\n        "title": str,\n        "lesson_number": int,\n        "completed": bool,\n    }\n    missing = [k for k in required if k not in course]\n    if missing:\n        print(f"缺少字段：{missing}")\n        return False\n    for key, expected_type in required.items():\n        if not isinstance(course[key], expected_type):\n            print(f"{key} 类型错误：预期 {expected_type.__name__}")\n            return False\n    return True\n\ncourse1 = {"title": "Python 基础", "lesson_number": 1, "completed": False, "tags": ["入门"]}\ncourse2 = {"title": "Python 基础", "completed": False}\n\nfor i, course in enumerate([course1, course2], 1):\n    print(f"\\n课程 {i}：")\n    if validate_course(course):\n        for key, value in course.items():\n            print(f"  {key}: {value}")',
    relatedTutorials: ['dicts'],
  },

  {
    id: 'ex-python-sets-01',
    title: '用集合比较文件列表',
    description: '有两份文件名列表：expected = ["case-A.txt", "case-B.txt", "case-C.txt", "case-D.txt"] 和 received = ["case-A.txt", "case-C.txt", "case-E.txt"]。使用集合操作分别找出：(1) 两个列表都有的文件；(2) 只在预期中但未收到的文件；(3) 收到但不在预期中的文件。所有结果按名称排序输出。',
    hints: [
      'set expected 和 set received 做交并差运算',
      '交集 & 找共有的，差集 - 找独有的',
      'sorted() 对集合排序得到列表',
    ],
    answer: 'expected = ["case-A.txt", "case-B.txt", "case-C.txt", "case-D.txt"]\nreceived = ["case-A.txt", "case-C.txt", "case-E.txt"]\n\nset_e = set(expected)\nset_r = set(received)\n\ncommon = set_e & set_r\nmissing = set_e - set_r\nunexpected = set_r - set_e\n\nprint("共有：", sorted(common))        # [\'case-A.txt\', \'case-C.txt\']\nprint("缺少：", sorted(missing))       # [\'case-B.txt\', \'case-D.txt\']\nprint("计划外：", sorted(unexpected))  # [\'case-E.txt\']',
    relatedTutorials: ['sets'],
  },

  // ==========================================
  // 函数与模块（对应 structure 模块后半部分）
  // ==========================================

  {
    id: 'ex-python-functions-01',
    title: '拆分程序为三个独立函数',
    description: '有一个读取三个数并计算平均值的脚本。请将其拆分为三个独立函数：(1) parse_numbers(text) — 解析以空格分隔的数值字符串，返回数字列表；(2) compute_stats(values) — 返回 (数量, 平均值) 元组；(3) format_report(count, average) — 返回格式化的报告字符串。最后写 main() 整合调用三个函数。',
    hints: [
      'str.split() 可以按空格分割输入',
      '每个函数应只做一件事，通过参数和返回值通信',
      '在 main() 中串联调用，而不是在函数内部调用其他函数',
    ],
    answer: 'def parse_numbers(text):\n    """将空格分隔的字符串解析为数字列表"""\n    return [float(part) for part in text.strip().split()]\n\ndef compute_stats(values):\n    """返回 (数量, 平均值)"""\n    if not values:\n        return (0, 0.0)\n    return (len(values), sum(values) / len(values))\n\ndef format_report(count, average):\n    """返回格式化的报告"""\n    return f"共 {count} 个数值，平均值为 {average:.2f}"\n\ndef main():\n    text = input("请输入数字，用空格分隔：")\n    values = parse_numbers(text)\n    count, average = compute_stats(values)\n    print(format_report(count, average))\n\nif __name__ == "__main__":\n    main()',
    relatedTutorials: ['functions'],
  },

  {
    id: 'ex-python-modules-01',
    title: '将函数拆分为独立模块',
    description: '把上一题中的三个函数拆分到两个模块中：(1) parsing.py — 包含 parse_numbers()；(2) statistics_tools.py — 包含 compute_stats() 和 format_report()。在 main.py 中导入这两个模块并调用。确认每个模块可以直接运行（通过 if __name__ == "__main__" 编写测试）。',
    hints: [
      'from parsing import parse_numbers',
      'from statistics_tools import compute_stats, format_report',
      '每个模块的 if __name__ == "__main__" 块写一个简单测试',
    ],
    answer: '# parsing.py\ndef parse_numbers(text):\n    return [float(part) for part in text.strip().split()]\n\nif __name__ == "__main__":\n    print(parse_numbers("1.0 2.5 3.2"))  # [1.0, 2.5, 3.2]\n\n# statistics_tools.py\ndef compute_stats(values):\n    if not values:\n        return (0, 0.0)\n    return (len(values), sum(values) / len(values))\n\ndef format_report(count, average):\n    return f"共 {count} 个数值，平均值为 {average:.2f}"\n\nif __name__ == "__main__":\n    c, a = compute_stats([1, 2, 3])\n    print(format_report(c, a))  # 共 3 个数值，平均值为 2.00\n\n# main.py\nfrom parsing import parse_numbers\nfrom statistics_tools import compute_stats, format_report\n\ndef main():\n    text = input("请输入数字：")\n    values = parse_numbers(text)\n    count, average = compute_stats(values)\n    print(format_report(count, average))\n\nif __name__ == "__main__":\n    main()',
    relatedTutorials: ['modules-packages'],
  },

  {
    id: 'ex-python-file-io-01',
    title: '读写文本文件并处理错误行',
    description: '创建一个文本文件 values.txt，输入 5 行 "名称,数值" 格式的数据，其中故意混入 1-2 行无效数据（如格式错误、空行）。编写程序逐行读取，解析有效行并计算所有有效数值的平均值，同时将所有格式错误的行号及内容写入 errors.log。最后输出有效记录数和平均值。',
    hints: [
      '用 Path("values.txt").open() 逐行读取',
      '每行用 .strip().split(",") 解析',
      '用 try/except 捕获 float 转换失败',
      '错误行追加写入 errors.log（模式 "a"）',
    ],
    answer: 'from pathlib import Path\n\n# 创建测试文件\nPath("values.txt").write_text(\n    "case-A,12.5\\ncase-B,18.0\\nbad-line\\ncase-C,9.6\\n\\ncase-D,invalid\\n",\n    encoding="utf-8"\n)\n\nvalues = []\nerror_lines = []\n\nwith Path("values.txt").open(encoding="utf-8") as f:\n    for line_num, line in enumerate(f, start=1):\n        text = line.strip()\n        if not text:\n            error_lines.append((line_num, "<空行>"))\n            continue\n        parts = text.split(",")\n        if len(parts) != 2:\n            error_lines.append((line_num, text))\n            continue\n        try:\n            values.append(float(parts[1]))\n        except ValueError:\n            error_lines.append((line_num, text))\n\n# 写入错误日志\nwith Path("errors.log").open("w", encoding="utf-8") as f:\n    for num, content in error_lines:\n        f.write(f"第 {num} 行：{content}\\n")\n\nif values:\n    print(f"有效记录 {len(values)} 条")\n    print(f"平均值：{sum(values)/len(values):.2f}")\nelse:\n    print("没有有效记录")',
    relatedTutorials: ['file-io'],
  },

  {
    id: 'ex-python-error-handling-01',
    title: '为文件解析程序添加分层错误处理',
    description: '编写一个健壮的配置文件解析函数 parse_config(path)，读取键值对格式的文本文件（每行 key=value）。要求区分四种错误：(1) 文件不存在；(2) 文件编码错误（不是 UTF-8）；(3) 某行格式错误（缺少 = 号）；(4) 空文件。每种错误应有不同的错误信息和处理方式，但不会让程序崩溃。解析成功时返回 dict。',
    hints: [
      '用 try/except FileNotFoundError 处理文件不存在',
      '用 try/except UnicodeDecodeError 处理编码错误',
      '用 try/except ValueError 处理解析失败',
      '返回 (dict, errors_list) 元组，调用者可以检查 errors',
    ],
    answer: 'from pathlib import Path\n\ndef parse_config(path):\n    config = {}\n    errors = []\n    \n    path_obj = Path(path)\n    if not path_obj.exists():\n        errors.append(("FATAL", f"文件不存在：{path}"))\n        return config, errors\n    \n    try:\n        text = path_obj.read_text(encoding="utf-8")\n    except UnicodeDecodeError:\n        errors.append(("FATAL", f"文件不是 UTF-8 编码：{path}"))\n        return config, errors\n    \n    lines = text.strip().split("\\n")\n    if not lines or (len(lines) == 1 and not lines[0].strip()):\n        errors.append(("WARN", "文件为空"))\n        return config, errors\n    \n    for line_num, line in enumerate(lines, start=1):\n        cleaned = line.strip()\n        if not cleaned:\n            continue\n        if "=" not in cleaned:\n            errors.append((f"第 {line_num} 行", f"缺少 = 号：{cleaned}"))\n            continue\n        key, _, value = cleaned.partition("=")\n        config[key.strip()] = value.strip()\n    \n    return config, errors\n\ncfg, errs = parse_config("settings.txt")\nprint("配置：", cfg)\nfor loc, msg in errs:\n    print(f"[{loc}] {msg}")',
    relatedTutorials: ['error-handling'],
  },
] as const;
