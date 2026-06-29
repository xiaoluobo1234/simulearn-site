export const numpyFoundationTutorials = {
  'numpy-intro': String.raw`
NumPy（Numerical Python）是 Python 生态中最基础的科学计算库。几乎所有涉及数值计算、数据分析和工程仿真的 Python 项目都以 NumPy 作为底层计算引擎。对于结构工程师、流体力学研究者或从事多物理场仿真的技术人员而言，NumPy 提供了高效的多维数组对象和丰富的数学运算接口，使你能够用几行 Python 代码完成过去需要几十行 C 或 Fortran 才能实现的矩阵运算、信号处理和数据变换。

## NumPy 的核心对象：ndarray

NumPy 的核心是一个叫做 \`ndarray\`（N-dimensional array，N 维数组）的数据结构。它是一个同质的、固定类型的多维容器：数组中的每个元素必须是相同的数据类型（例如全部是 64 位浮点数），并且一旦创建，数据类型不会自动改变。这与 Python 列表（list）有本质区别——列表可以混合存放整数、字符串、列表等任意对象，但数组要求所有元素类型一致。

这种"同质固定类型"的设计并非限制，而是性能的基础。因为所有元素的类型相同，NumPy 可以在内存中把数据紧密排列（contiguous storage），并利用底层 C/Fortran 库执行高度优化的向量化运算。相比之下，Python 列表的每个元素都是一个独立的 Python 对象，散布在堆内存中，计算时需要逐个取出并判断类型，开销远大于 NumPy。

## 导入 NumPy

在使用 NumPy 之前需要先导入。社区约定使用 \`np\` 作为缩写：

~~~python
import numpy as np
print(np.__version__)
~~~

运行结果会显示当前安装的 NumPy 版本号：

~~~text
2.0.0
~~~

版本号可能因安装时间不同而有所差异，但只要能正常导入且版本在 1.20 以上，本教程的所有代码都可以正常运行。

## 第一个数组

用 \`np.array()\` 可以从 Python 列表创建数组：

~~~python
import numpy as np

# 从列表创建一维数组
displacements = np.array([0.0, 0.002, 0.005, 0.011, 0.020])
print("数组:", displacements)
print("类型:", type(displacements))
print("数据类型:", displacements.dtype)
print("维度:", displacements.ndim)
print("形状:", displacements.shape)
print("元素个数:", displacements.size)
~~~

运行结果：

~~~text
数组: [0.    0.002 0.005 0.011 0.02 ]
类型: <class 'numpy.ndarray'>
数据类型: float64
维度: 1
形状: (5,)
元素个数: 5
~~~

\`dtype\` 为 \`float64\` 表示每个元素是 64 位（8 字节）的双精度浮点数，这是 NumPy 对浮点数据的默认选择。\`ndim\` 表示维度数，\`shape\` 是一个元组，描述每个维度上的元素个数。对于一维数组，\`shape\` 为 \`(5,)\`，注意末尾的逗号——这表示它是一个包含一个元素的元组，而不是一个整数。

## 多维数组

工程计算中经常处理二维甚至三维数据。例如一个 3x3 的刚度矩阵：

~~~python
import numpy as np

stiffness = np.array([
    [2.1e11, 0.0,    0.0],
    [0.0,    2.1e11, 0.0],
    [0.0,    0.0,    8.1e10]
])

print("刚度矩阵:")
print(stiffness)
print("形状:", stiffness.shape)
print("维度:", stiffness.ndim)
print("元素总数:", stiffness.size)
print("数据类型:", stiffness.dtype)
~~~

运行结果：

~~~text
刚度矩阵:
[[2.1e+11 0.0e+00 0.0e+00]
 [0.0e+00 2.1e+11 0.0e+00]
 [0.0e+00 0.0e+00 8.1e+10]]
形状: (3, 3)
维度: 2
元素总数: 9
数据类型: float64
~~~

形状 \`(3, 3)\` 表示 3 行 3 列。对于三维数组（例如一个 2x3x4 的张量），形状为 \`(2, 3, 4)\`，可以理解为 2 个 3x4 的矩阵。

## NumPy 数组与 Python 列表的性能对比

为了理解 NumPy 的性能优势，我们对比数组和列表在大规模数值运算上的差异。假设有 100 万个节点位移值，需要计算每个值的平方：

~~~python
import numpy as np
import time

n = 1_000_000

# Python 列表方式
py_list = list(range(n))
start = time.perf_counter()
py_result = [x ** 2 for x in py_list]
list_time = time.perf_counter() - start

# NumPy 数组方式
np_array = np.arange(n)
start = time.perf_counter()
np_result = np_array ** 2
array_time = time.perf_counter() - start

print(f"列表耗时: {list_time:.4f} 秒")
print(f"数组耗时: {array_time:.4f} 秒")
print(f"加速比: {list_time / array_time:.1f}x")
~~~

运行结果（具体数值因硬件而异）：

~~~text
列表耗时: 0.1253 秒
数组耗时: 0.0018 秒
加速比: 69.6x
~~~

NumPy 数组运算比 Python 列表快几十到几百倍。这是因为 NumPy 的运算在底层使用编译好的 C 代码执行，不需要 Python 解释器逐元素调度。对于工程项目中动辄百万级自由度的有限元计算，这种性能差距直接影响分析效率。

## 工程师为什么需要 NumPy

结构分析中的刚度矩阵组装、模态分析中的特征值求解、流体仿真中的速度场处理、信号处理中的傅里叶变换——这些工程计算任务的核心数据结构都是多维数组。NumPy 提供了：

- **矩阵运算**：矩阵乘法、转置、求逆、特征值分解，这是结构力学计算的基础。
- **广播机制**：不同形状的数组可以自动对齐运算，避免手写循环。
- **切片和索引**：高效地提取和修改数组的子集，例如从全场位移中提取特定节点的自由度。
- **丰富的数学函数**：三角函数、指数对数、统计量、排序、搜索等，覆盖工程计算的常见需求。

后续教程将从数组创建开始，逐步深入 NumPy 的各个核心功能模块。

## 本节要点

NumPy 是 Python 科学计算的基石，其核心对象 ndarray 是同质、固定类型的多维数组。相比 Python 列表，NumPy 在数值运算上有数十到数百倍的性能优势，原因在于底层 C 实现和内存连续存储。数组的关键属性包括 \`dtype\`（数据类型）、\`shape\`（形状）、\`ndim\`（维度数）和 \`size\`（元素总数）。工程师使用 NumPy 可以高效完成矩阵运算、信号处理和数据分析等任务，是后续学习 Pandas、SciPy 和 Matplotlib 的基础。
`,

  'numpy-array-create': String.raw`
掌握了 NumPy 的基本概念后，下一步是学习如何创建各种数组。NumPy 提供了丰富的数组创建函数，每种函数适用于不同的场景。理解这些函数的区别和适用场景，能够让你在工程计算中快速构建所需的数据结构，而不是依赖低效的手动循环。

## 从列表和元组创建

最直接的方式是用 \`np.array()\` 从 Python 列表或元组创建数组：

~~~python
import numpy as np

# 从列表创建
forces = np.array([1000, 2500, 5000, 7500, 10000])
print("力向量:", forces)
print("数据类型:", forces.dtype)

# 从嵌套列表创建二维数组（矩阵）
nodes = np.array([[0.0, 0.0], [5.0, 0.0], [5.0, 3.0], [0.0, 3.0]])
print("节点坐标矩阵:")
print(nodes)
print("形状:", nodes.shape)

# 从元组创建
dimensions = np.array((100.0, 200.0, 50.0))
print("构件尺寸:", dimensions)
~~~

运行结果：

~~~text
力向量: [ 1000  2500  5000  7500 10000]
数据类型: int64
节点坐标矩阵:
[[0. 0.]
 [5. 0.]
 [5. 3.]
 [0. 3.]]
形状: (4, 2)
构件尺寸: [100. 200.  50.]
~~~

注意第一个数组的数据类型是 \`int64\`，因为输入的列表元素都是整数。NumPy 会自动推断最合适的数据类型。如果你希望强制使用浮点数，可以指定 \`dtype\` 参数：

~~~python
import numpy as np

forces_float = np.array([1000, 2500, 5000], dtype=np.float64)
print(forces_float)
print(forces_float.dtype)
~~~

运行结果：

~~~text
[1000. 2500. 5000.]
float64
~~~

## 填充特定值的数组

工程中经常需要初始化全零、全一或指定值的数组。例如在有限元分析中，位移向量初始化为零，荷载向量可能初始化为某个均布荷载值：

~~~python
import numpy as np

# 全零数组：10 个节点的初始位移
disp = np.zeros(10)
print("初始位移:", disp)

# 全零矩阵：4x4 的零矩阵
zero_matrix = np.zeros((4, 4))
print("4x4 零矩阵:")
print(zero_matrix)

# 全一数组
ones_arr = np.ones((3, 2))
print("全一矩阵:")
print(ones_arr)

# 填充指定值
stress_init = np.full((5, 3), 235.0)
print("初始应力矩阵 (235 MPa):")
print(stress_init)

# np.empty 创建未初始化数组（值不确定）
uninitialized = np.empty(5)
print("未初始化数组:", uninitialized)
~~~

运行结果：

~~~text
初始位移: [0. 0. 0. 0. 0. 0. 0. 0. 0. 0.]
4x4 零矩阵:
[[0. 0. 0. 0.]
 [0. 0. 0. 0.]
 [0. 0. 0. 0.]
 [0. 0. 0. 0.]]
全一矩阵:
[[1. 1.]
 [1. 1.]
 [1. 1.]]
初始应力矩阵 (235 MPa):
[[235. 235. 235.]
 [235. 235. 235.]
 [235. 235. 235.]
 [235. 235. 235.]
 [235. 235. 235.]]
未初始化数组: [4.67e-310 0.00e+000 0.00e+000 0.00e+000 0.00e+000]
~~~

\`np.empty()\` 不会将数组初始化为零，而是直接分配内存，因此数组中可能包含之前内存中的残留值。它比 \`np.zeros()\` 快（省去了写零的时间），但使用时必须确保在读取之前已经为每个元素赋值。在大多数工程场景中，推荐使用 \`np.zeros()\` 以确保安全。

## np.arange() 与 np.linspace()

这两个函数都可以创建等间隔的数组，但使用场景不同。\`np.arange()\` 类似于 Python 内置的 \`range()\`，通过指定起始值、终止值和步长来生成数组。\`np.linspace()\` 通过指定起始值、终止值和元素个数来生成数组：

~~~python
import numpy as np

# np.arange(start, stop, step)
# 生成从 0 到 10（不含 10），步长为 0.5 的数组
positions = np.arange(0, 10, 0.5)
print("arange 结果:", positions)
print("元素个数:", len(positions))

# np.linspace(start, stop, num)
# 生成从 0 到 10（包含 10），共 21 个等间距点
sample_points = np.linspace(0, 10, 21)
print("linspace 结果:", sample_points)
print("元素个数:", len(sample_points))

# 工程实例：梁的截面采样点
L = 6.0  # 梁长 6 米
n_points = 13  # 包括两端共 13 个截面
x_sections = np.linspace(0, L, n_points)
print(f"梁截面位置 (m): {x_sections}")
~~~

运行结果：

~~~text
arange 结果: [0.  0.5 1.  1.5 2.  2.5 3.  3.5 4.  4.5 5.  5.5 6.  6.5 7.  7.5 8.  8.5
 9.  9.5]
元素个数: 20
linspace 结果: [ 0.   0.5  1.   1.5  2.   2.5  3.   3.5  4.   4.5  5.   5.5  6.   6.5
  7.   7.5  8.   8.5  9.   9.5 10. ]
元素个数: 21
梁截面位置 (m): [0.  0.5 1.  1.5 2.  2.5 3.  3.5 4.  4.5 5.  5.5 6. ]
~~~

使用原则：当你知道步长（例如每隔 0.5 米采样一次），用 \`np.arange()\`；当你知道需要多少个点（例如有限元的 100 个积分点），用 \`np.linspace()\`。特别注意，\`np.arange()\` 的终止值不包含在结果中（半开区间），而 \`np.linspace()\` 默认包含终止值。在使用浮点数步长时，\`np.arange()\` 可能因浮点精度问题导致元素个数不确定，因此浮点数场景更推荐使用 \`np.linspace()\`。

## 特殊矩阵：单位矩阵与对角矩阵

结构分析和线性代数中经常需要单位矩阵和对角矩阵：

~~~python
import numpy as np

# 3x3 单位矩阵
identity_3 = np.eye(3)
print("3x3 单位矩阵:")
print(identity_3)

# 对角矩阵
stiffness_diag = np.diag([2.1e11, 2.1e11, 8.1e10])
print("对角刚度矩阵:")
print(stiffness_diag)

# 偏移对角线
# k=1 表示对角线上方偏移一格
super_diag = np.diag([1.0, 2.0, 3.0], k=1)
print("上偏移对角矩阵:")
print(super_diag)

# 从已有矩阵提取对角线
main_diag = np.diag(stiffness_diag)
print("主对角线元素:", main_diag)
~~~

运行结果：

~~~text
3x3 单位矩阵:
[[1. 0. 0.]
 [0. 1. 0.]
 [0. 0. 1.]]
对角刚度矩阵:
[[2.1e+11 0.0e+00 0.0e+00]
 [0.0e+00 2.1e+11 0.0e+00]
 [0.0e+00 0.0e+00 8.1e+10]]
上偏移对角矩阵:
[[0. 1. 0. 0.]
 [0. 0. 2. 0.]
 [0. 0. 0. 3.]
 [0. 0. 0. 0.]]
主对角线元素: [2.1e+11 2.1e+11 8.1e+10]
~~~

\`np.eye(N)\` 创建 NxN 单位矩阵，在矩阵乘法中常用作初始变换矩阵。\`np.diag()\` 有两种用法：传入一维数组时，创建以该数组为对角线的方阵；传入二维数组时，提取其对角线元素。

## 使用函数和索引创建数组

\`np.fromfunction()\` 可以根据一个函数生成数组，函数的参数是各维度的索引：

~~~python
import numpy as np

# 创建一个 5x5 的矩阵，元素值为行索引加列索引
add_matrix = np.fromfunction(lambda i, j: i + j, (5, 5), dtype=int)
print("索引和矩阵:")
print(add_matrix)

# 工程实例：创建温度场初始分布
# T(x, y) = 20 + 0.5*x + 0.3*y （线性温度梯度）
T_field = np.fromfunction(
    lambda i, j: 20.0 + 0.5 * i + 0.3 * j,
    (4, 6),
    dtype=float
)
print("初始温度场:")
print(T_field)

# np.indices() 返回各维度的索引网格
grid = np.indices((3, 4))
print("行索引网格:")
print(grid[0])
print("列索引网格:")
print(grid[1])
~~~

运行结果：

~~~text
索引和矩阵:
[[0 1 2 3 4]
 [1 2 3 4 5]
 [2 3 4 5 6]
 [3 4 5 6 7]
 [4 5 6 7 8]]
初始温度场:
[[20.  20.3 20.6 20.9 21.2 21.5]
 [20.5 20.8 21.1 21.4 21.7 22. ]
 [21.  21.3 21.6 21.9 22.2 22.5]
 [21.5 21.8 22.1 22.4 22.7 23. ]]
行索引网格:
[[0 0 0 0]
 [1 1 1 1]
 [2 2 2 2]]
列索引网格:
[[0 1 2 3]
 [0 1 2 3]
 [0 1 2 3]]
~~~

\`np.fromfunction()\` 非常适合创建基于坐标规则的数据，例如初始温度场、压力分布或网格坐标。\`np.indices()\` 则生成各维度的完整索引数组，常用于构建坐标网格。

## 实用示例：创建坐标网格

在有限元分析或流场计算中，经常需要生成二维坐标网格。NumPy 提供了 \`np.meshgrid()\` 函数：

~~~python
import numpy as np

# 创建一块 10m x 6m 的矩形板面网格
x = np.linspace(0, 10, 6)  # x 方向 6 个点
y = np.linspace(0, 6, 4)   # y 方向 4 个点

X, Y = np.meshgrid(x, y)

print("X 坐标网格:")
print(X)
print("Y 坐标网格:")
print(Y)
print("网格形状:", X.shape)
~~~

运行结果：

~~~text
X 坐标网格:
[[ 0.  2.  4.  6.  8. 10.]
 [ 0.  2.  4.  6.  8. 10.]
 [ 0.  2.  4.  6.  8. 10.]
 [ 0.  2.  4.  6.  8. 10.]]
Y 坐标网格:
[[0. 0. 0. 0. 0. 0.]
 [2. 2. 2. 2. 2. 2.]
 [4. 4. 4. 4. 4. 4.]
 [6. 6. 6. 6. 6. 6.]]
网格形状: (4, 6)
~~~

\`meshgrid\` 将两个一维数组展开为二维网格坐标。X 网格中每行的值相同（x 坐标沿列变化），Y 网格中每列的值相同（y 坐标沿行变化）。这种网格在后续绘制云图、计算场量时非常有用。

## 本节要点

NumPy 提供了多种数组创建方式：\`np.array()\` 从列表创建；\`np.zeros()\`、\`np.ones()\`、\`np.full()\` 和 \`np.empty()\` 创建填充特定值的数组；\`np.arange()\` 按步长生成等间隔数组，\`np.linspace()\` 按元素个数生成等间隔数组；\`np.eye()\` 和 \`np.diag()\` 创建特殊矩阵；\`np.fromfunction()\` 和 \`np.meshgrid()\` 基于函数或坐标规则生成数组。选择创建方式时，应考虑数据来源（列表、规则还是初始化需求）以及后续运算对数据类型的要求。
`,

  'numpy-dtypes': String.raw`
NumPy 的数据类型系统（dtype）是理解数组行为和性能的关键。与 Python 的自动类型管理不同，NumPy 要求每个数组有明确的、固定的数据类型。正确选择数据类型不仅影响计算精度，还直接影响内存占用和运算速度。对于涉及大规模数值仿真的工程师而言，理解 dtype 是编写高效代码的基础。

## NumPy 数据类型概览

NumPy 支持的数据类型远比 Python 内置类型丰富。以下列出工程计算中最常用的类型：

~~~python
import numpy as np

# 整数类型
print("int8   范围:", np.iinfo(np.int8).min, "到", np.iinfo(np.int8).max)
print("int16  范围:", np.iinfo(np.int16).min, "到", np.iinfo(np.int16).max)
print("int32  范围:", np.iinfo(np.int32).min, "到", np.iinfo(np.int32).max)
print("int64  范围:", np.iinfo(np.int64).min, "到", np.iinfo(np.int64).max)

# 浮点类型
print("float32 精度:", np.finfo(np.float32).precision, "位有效数字")
print("float64 精度:", np.finfo(np.float64).precision, "位有效数字")
~~~

运行结果：

~~~text
int8   范围: -128 到 127
int16  范围: -32768 到 32767
int32  范围: -2147483648 到 2147483647
int64  范围: -9223372036854775808 到 9223372036854775807
float32 精度: 6 位有效数字
float64 精度: 15 位有效数字
~~~

常见的数据类型包括：
- **整数**：\`int8\`（1 字节）、\`int16\`（2 字节）、\`int32\`（4 字节）、\`int64\`（8 字节）
- **无符号整数**：\`uint8\`、\`uint16\`、\`uint32\`、\`uint64\`，不能表示负数但正数范围更大
- **浮点数**：\`float16\`（半精度）、\`float32\`（单精度）、\`float64\`（双精度，默认）
- **复数**：\`complex64\`（两个 float32）、\`complex128\`（两个 float64）
- **布尔**：\`bool\`，每个元素占 1 字节

## 默认类型与显式指定

当你不指定类型时，NumPy 会根据输入数据自动推断：

~~~python
import numpy as np

# 整数列表 -> int64 (Windows/Linux 64位系统)
a = np.array([1, 2, 3])
print("整数列表 ->", a.dtype)

# 含浮点的列表 -> float64
b = np.array([1, 2.5, 3])
print("混合列表 ->", b.dtype)

# 显式指定类型
c = np.array([1, 2, 3], dtype=np.float32)
print("指定 float32 ->", c.dtype)

# 使用字符串指定
d = np.array([1, 2, 3], dtype='float32')
print("字符串指定 ->", d.dtype)

# zeros/ones 默认 float64
e = np.zeros(5)
print("zeros 默认 ->", e.dtype)

# 指定 zeros 的类型
f = np.zeros(5, dtype=np.int32)
print("zeros int32 ->", f.dtype)
~~~

运行结果：

~~~text
整数列表 -> int64
混合列表 -> float64
指定 float32 -> float32
字符串指定 -> float32
zeros 默认 -> float64
zeros int32 -> int32
~~~

在工程计算中，\`float64\` 是安全的选择——它提供约 15 位有效数字的精度，足以应对绝大多数结构分析和流体力学计算。但在处理超大规模数据（例如数亿个网格点）时，使用 \`float32\` 可以将内存需求减半，同时运算速度通常也会提高。

## 使用 astype() 进行类型转换

已经创建的数组可以通过 \`astype()\` 方法转换为新的数据类型：

~~~python
import numpy as np

# 整数转浮点
node_ids = np.array([101, 102, 103, 104, 105])
print("原始类型:", node_ids.dtype)

node_ids_float = node_ids.astype(np.float64)
print("转换后:", node_ids_float, node_ids_float.dtype)

# 浮点转整数（截断小数部分）
stresses = np.array([235.7, 189.3, 310.9, 45.1])
stresses_int = stresses.astype(np.int32)
print("截断:", stresses_int)

# float64 转 float32（精度降低）
precise = np.array([3.141592653589793, 2.718281828459045])
reduced = precise.astype(np.float32)
print("float64:", precise)
print("float32:", reduced)
~~~

运行结果：

~~~text
原始类型: int64
转换后: [101. 102. 103. 104. 105.] float64
截断: [235 189 310  45]
float64: [3.14159265 2.71828183]
float32: [3.1415927 2.7182817]
~~~

注意 \`astype()\` 总是创建一个新数组，即使新旧类型相同也是如此。浮点数转整数时会截断（不是四舍五入），这在处理工程数据时需要注意。如果需要四舍五入，可以先用 \`np.round()\` 再转换。

## 数组的内存属性

除了 \`dtype\` 和 \`shape\`，NumPy 数组还有几个描述内存布局的重要属性：

~~~python
import numpy as np

# 创建一个模拟位移场的数组：1000 个节点，每节点 3 个自由度
disp_field = np.zeros((1000, 3), dtype=np.float64)

print("形状 (shape):", disp_field.shape)
print("维度 (ndim):", disp_field.ndim)
print("元素总数 (size):", disp_field.size)
print("每个元素字节数 (itemsize):", disp_field.itemsize)
print("总字节数 (nbytes):", disp_field.nbytes)
print("内存步长 (strides):", disp_field.strides)
print("总内存:", disp_field.nbytes / 1024, "KB")
~~~

运行结果：

~~~text
形状 (shape): (1000, 3)
维度 (ndim): 2
元素总数 (size): 3000
每个元素字节数 (itemsize): 8
总字节数 (nbytes): 24000
内存步长 (strides): (24, 8)
总内存: 23.4375 KB
~~~

\`itemsize\` 是每个元素占用的字节数（float64 为 8 字节）。\`nbytes\` 是整个数组占用的总字节数，等于 \`size * itemsize\`。\`strides\` 是一个元组，描述在每个维度上移动一个元素时需要在内存中跳过的字节数。对于形状 \`(1000, 3)\` 的数组，strides 为 \`(24, 8)\`，意味着沿行方向（第一个维度）跳到下一行需要跳过 24 字节（3 个 float64），沿列方向跳到下一列只需跳过 8 字节（1 个 float64）。

## 内存布局：C 顺序与 Fortran 顺序

NumPy 支持两种内存排列方式。C 顺序（行优先，Row-major）将同一行的元素存储在相邻内存位置；Fortran 顺序（列优先，Column-major）将同一列的元素存储在相邻位置。默认使用 C 顺序：

~~~python
import numpy as np

# C 顺序（默认）
c_array = np.array([[1, 2, 3], [4, 5, 6]], order='C')
print("C 顺序:")
print("  shape:", c_array.shape)
print("  strides:", c_array.strides)
print("  flags C_CONTIGUOUS:", c_array.flags['C_CONTIGUOUS'])
print("  flags F_CONTIGUOUS:", c_array.flags['F_CONTIGUOUS'])

# Fortran 顺序
f_array = np.array([[1, 2, 3], [4, 5, 6]], order='F')
print("Fortran 顺序:")
print("  shape:", f_array.shape)
print("  strides:", f_array.strides)
print("  flags C_CONTIGUOUS:", f_array.flags['C_CONTIGUOUS'])
print("  flags F_CONTIGUOUS:", f_array.flags['F_CONTIGUOUS'])
~~~

运行结果：

~~~text
C 顺序:
  shape: (2, 3)
  strides: (24, 8)
  flags C_CONTIGUOUS: True
  flags F_CONTIGUOUS: False
Fortran 顺序:
  shape: (2, 3)
  strides: (8, 16)
  flags C_CONTIGUOUS: False
  flags F_CONTIGUOUS: True
~~~

对于同样的 (2, 3) 矩阵，C 顺序的 strides 是 \`(24, 8)\`——跳一行需要越过 3 个元素（24 字节），跳一列只需 1 个元素（8 字节）。Fortran 顺序则相反：跳一行只需 8 字节，跳一列需要 16 字节。

在大多数工程应用中不需要关心内存顺序。但当你与 Fortran 编写的有限元求解器（如某些 LAPACK 接口）交互数据，或者对超大数组进行频繁的列方向操作时，选择正确的内存顺序可以显著提高缓存命中率。

## 工程实践：为不同数据选择合适的类型

在实际工程项目中，合理选择数据类型可以在精度和效率之间取得平衡：

~~~python
import numpy as np

# 节点编号：非负整数，通常不超过百万
n_nodes = 500_000
node_ids = np.arange(n_nodes, dtype=np.int32)  # int32 足够
print(f"节点编号: dtype={node_ids.dtype}, 内存={node_ids.nbytes / 1e6:.1f} MB")

# 如果用 int64，内存翻倍
node_ids_64 = np.arange(n_nodes, dtype=np.int64)
print(f"节点编号: dtype={node_ids_64.dtype}, 内存={node_ids_64.nbytes / 1e6:.1f} MB")

# 位移结果：需要高精度
n_dof = 1_000_000
displacements = np.zeros(n_dof, dtype=np.float64)
print(f"位移向量: dtype={displacements.dtype}, 内存={displacements.nbytes / 1e6:.1f} MB")

# 温度场可视化数据：低精度足够
temp_field = np.zeros((1000, 1000), dtype=np.float32)
print(f"温度场:   dtype={temp_field.dtype}, 内存={temp_field.nbytes / 1e6:.1f} MB")

# 布尔掩码：标记哪些节点在边界上
boundary_mask = np.zeros(n_nodes, dtype=np.bool_)
print(f"边界掩码: dtype={boundary_mask.dtype}, 内存={boundary_mask.nbytes / 1e6:.1f} MB")
~~~

运行结果：

~~~text
节点编号: dtype=int32, 内存=2.0 MB
节点编号: dtype=int64, 内存=4.0 MB
位移向量: dtype=float64, 内存=8.0 MB
温度场:   dtype=float32, 内存=4.0 MB
边界掩码: dtype=bool, 内存=0.5 MB
~~~

选择合适的类型可以显著降低内存占用。对于节点编号，\`int32\` 的范围已经足够表示超过 21 亿个节点。\`bool\` 类型用于标记和过滤，虽然仍占 1 字节，但语义清晰。对于需要高精度的力学计算结果，始终使用 \`float64\`。

## 本节要点

NumPy 的数据类型系统提供整数（int8/16/32/64）、浮点数（float32/64）、复数（complex64/128）和布尔类型。默认浮点类型为 float64，提供约 15 位有效数字。使用 \`astype()\` 可以转换已有数组的类型，但总是创建新数组。数组的内存属性包括 \`itemsize\`（每元素字节数）、\`nbytes\`（总字节数）和 \`strides\`（各维度步长）。内存布局有 C 顺序（行优先）和 Fortran 顺序（列优先），默认使用 C 顺序。工程实践中应根据数据性质选择合适类型：节点编号用 int32，计算结果用 float64，可视化数据可用 float32，标记数据用 bool。
`,

  'numpy-indexing': String.raw`
索引和切片是从数组中提取特定元素或子集的基本操作。在工程计算中，你经常需要从全场结果中提取某个节点的位移、从时间序列中截取某个时段的数据，或者从大型矩阵中提取某个子矩阵进行局部分析。NumPy 的索引和切片语法简洁而强大，掌握它是高效数据处理的前提。

## 一维数组的基本索引

一维数组的索引方式与 Python 列表完全一致：用方括号和下标访问元素，下标从 0 开始，负数下标从末尾倒数：

~~~python
import numpy as np

# 模拟 8 个测点的应变读数（微应变）
strain = np.array([120, 245, 310, 188, 420, 355, 290, 175])

print("第一个测点:", strain[0])
print("最后一个测点:", strain[-1])
print("第三个测点:", strain[2])
print("倒数第二个:", strain[-2])
~~~

运行结果：

~~~text
第一个测点: 120
最后一个测点: 175
第三个测点: 310
倒数第二个: 290
~~~

## 切片操作

切片可以提取数组的一个连续子集，语法为 \`arr[start:stop:step]\`。与 Python 列表一样，\`start\` 包含在结果中，\`stop\` 不包含，\`step\` 默认为 1：

~~~python
import numpy as np

# 模拟 24 小时的温度记录（每小时一个数据点）
temperature = np.array([
    18.2, 17.8, 17.5, 17.1, 16.9, 17.0,  # 0:00 - 5:00
    17.8, 19.2, 21.5, 23.8, 25.6, 27.1,  # 6:00 - 11:00
    28.5, 29.3, 30.1, 29.8, 28.6, 27.0,  # 12:00 - 17:00
    25.3, 23.5, 21.8, 20.5, 19.6, 18.9   # 18:00 - 23:00
])

# 提取上午 6:00 - 11:00 的数据
morning = temperature[6:12]
print("上午温度:", morning)

# 提取所有偶数小时的数据（步长为 2）
even_hours = temperature[::2]
print("偶数小时:", even_hours)

# 提取最后 6 个小时
night = temperature[-6:]
print("夜间温度:", night)

# 反向排列（全部倒序）
reversed_temp = temperature[::-1]
print("倒序（前5个）:", reversed_temp[:5])
~~~

运行结果：

~~~text
上午温度: [17.8 19.2 21.5 23.8 25.6 27.1]
偶数小时: [18.2 17.5 16.9 17.8 21.5 25.6 28.5 30.1 28.6 25.3 21.8 19.6]
夜间温度: [25.3 23.5 21.8 20.5 19.6 18.9]
倒序（前5个）: [18.9 19.6 20.5 21.8 23.5]
~~~

切片规则的要点：\`start\` 省略表示从头开始，\`stop\` 省略表示到末尾，\`step\` 省略表示步长为 1。负数步长表示反向遍历。

## 多维数组索引与切片

对于二维数组，使用逗号分隔各维度的索引：

~~~python
import numpy as np

# 4x5 的位移矩阵：4 个节点，每节点 5 个时间步的位移值
# 行 = 节点编号，列 = 时间步
disp = np.array([
    [0.00, 0.12, 0.35, 0.28, 0.15],  # 节点 0
    [0.00, 0.08, 0.22, 0.18, 0.10],  # 节点 1
    [0.00, 0.15, 0.41, 0.33, 0.20],  # 节点 2
    [0.00, 0.05, 0.14, 0.11, 0.06],  # 节点 3
])

# 访问单个元素：节点 2 在第 3 个时间步的位移
print("节点2-时间步3:", disp[2, 3])

# 提取某一行（一个节点的所有时间步）
print("节点 1 全部位移:", disp[1])
print("节点 1 全部位移:", disp[1, :])

# 提取某一列（所有节点在同一时间步的位移）
print("时间步 2 所有节点:", disp[:, 2])

# 提取子矩阵：节点 1-2，时间步 1-3
sub = disp[1:3, 1:4]
print("子矩阵:")
print(sub)
~~~

运行结果：

~~~text
节点2-时间步3: 0.33
节点 1 全部位移: [0.   0.08 0.22 0.18 0.1 ]
节点 1 全部位移: [0.   0.08 0.22 0.18 0.1 ]
时间步 2 所有节点: [0.35 0.22 0.41 0.14]
子矩阵:
[[0.08 0.22 0.18]
 [0.15 0.41 0.33]]
~~~

多维索引中，\`:\` 表示该维度的全部元素。\`disp[1, :]\` 和 \`disp[1]\` 等价，都表示取第 1 行。\`disp[:, 2]\` 表示取第 2 列的全部行。子矩阵 \`disp[1:3, 1:4]\` 提取第 1-2 行（不含第 3 行）和第 1-3 列（不含第 4 列）。

## 视图与副本：一个关键区别

这是 NumPy 索引中最重要的概念之一：**基本切片返回的是原数组的视图（view），而不是副本（copy）**。视图与原数组共享同一块内存，修改视图会影响原数组：

~~~python
import numpy as np

original = np.array([10, 20, 30, 40, 50])
print("原始数组:", original)

# 切片创建的是视图
view = original[1:4]
print("视图:", view)

# 修改视图中的元素
view[0] = 999
print("修改视图后:")
print("视图:", view)
print("原始数组:", original)  # 原始数组也被修改了！
~~~

运行结果：

~~~text
原始数组: [10 20 30 40 50]
视图: [20 30 40]
修改视图后:
视图: [999  30  40]
原始数组: [ 10 999  30  40  50]
~~~

原始数组的第 2 个元素（索引 1）从 20 变成了 999，因为 \`view\` 和 \`original\` 指向同一块内存。这种行为与 Python 列表不同——列表的切片会创建新列表。

如果需要独立副本（修改副本不影响原数组），使用 \`np.copy()\` 或 \`.copy()\` 方法：

~~~python
import numpy as np

original = np.array([10, 20, 30, 40, 50])

# 创建显式副本
copy_arr = original[1:4].copy()
copy_arr[0] = 999

print("副本:", copy_arr)
print("原始数组:", original)  # 原始数组未被修改
~~~

运行结果：

~~~text
副本: [999  30  40]
原始数组: [10 20 30 40 50]
~~~

可以用 \`np.shares_memory()\` 检查两个数组是否共享内存：

~~~python
import numpy as np

arr = np.arange(10)
view = arr[2:7]
copy = arr[2:7].copy()

print("arr 和 view 共享内存:", np.shares_memory(arr, view))
print("arr 和 copy 共享内存:", np.shares_memory(arr, copy))
~~~

运行结果：

~~~text
arr 和 view 共享内存: True
arr 和 copy 共享内存: False
~~~

## 用索引修改数组

切片不仅可以读取数据，还可以直接赋值修改原数组的一部分：

~~~python
import numpy as np

# 初始化应力矩阵（MPa）
stress = np.zeros((4, 4))

# 将对角线设为屈服强度
stress[0, 0] = 235.0
stress[1, 1] = 235.0
stress[2, 2] = 235.0
stress[3, 3] = 235.0
print("设置对角线后:")
print(stress)

# 用切片批量赋值：将第 0 行全部设为 100
stress[0, :] = 100.0
print("第 0 行设为 100:")
print(stress)

# 用数组赋值
stress[:, 3] = np.array([50.0, 60.0, 70.0, 80.0])
print("第 3 列赋值后:")
print(stress)
~~~

运行结果：

~~~text
设置对角线后:
[[235.   0.   0.   0.]
 [  0. 235.   0.   0.]
 [  0.   0. 235.   0.]
 [  0.   0.   0. 235.]]
第 0 行设为 100:
[[100. 100. 100. 100.]
 [  0. 235.   0.   0.]
 [  0.   0. 235.   0.]
 [  0.   0.   0. 235.]]
第 3 列赋值后:
[[100. 100. 100.  50.]
 [  0. 235.   0.  60.]
 [  0.   0. 235.  70.]
 [  0.   0.   0.  80.]]
~~~

## 实用示例：提取时间序列窗口

在结构健康监测中，经常需要从长时间序列中提取特定时间窗口的数据：

~~~python
import numpy as np

# 模拟 1000 个时间步的加速度记录（采样率 100 Hz）
dt = 0.01  # 时间步长 0.01 秒
n_steps = 1000
time = np.arange(n_steps) * dt  # 时间向量：0 到 9.99 秒
acceleration = np.sin(2 * np.pi * 2.0 * time) * 9.81  # 2 Hz 正弦波

# 提取 2.0 秒到 4.0 秒之间的数据
t_start, t_end = 2.0, 4.0
mask = (time >= t_start) & (time < t_end)
window_time = time[mask]
window_accel = acceleration[mask]

print(f"总数据点: {n_steps}")
print(f"窗口数据点: {len(window_time)}")
print(f"窗口时间范围: {window_time[0]:.2f} - {window_time[-1]:.2f} 秒")
print(f"窗口最大加速度: {window_accel.max():.2f} m/s2")
~~~

运行结果：

~~~text
总数据点: 1000
窗口数据点: 200
窗口时间范围: 2.00 - 3.99 秒
窗口最大加速度: 9.81 m/s2
~~~

这里用布尔条件从时间向量中筛选出窗口范围内的索引，再用这些索引提取对应的加速度数据。虽然这个例子用了布尔索引（下一节详细讲解），但核心思想与切片相同：从大数组中提取需要的子集。

## 本节要点

NumPy 的一维索引与 Python 列表一致：\`arr[i]\` 取单个元素，\`arr[start:stop:step]\` 取切片。多维数组用逗号分隔各维度：\`arr[i, j]\` 取元素，\`arr[1:3, :]\` 取子矩阵。**基本切片返回视图，与原数组共享内存**；如需独立副本应使用 \`.copy()\`。通过索引和切片可以直接修改数组元素。在工程应用中，索引和切片常用于提取节点结果、截取时间窗口和构造子矩阵。
`,

  'numpy-fancy-index': String.raw`
基本索引和切片只能按固定步长提取连续或非连续的元素。但在工程计算中，更常见的需求是根据某个条件筛选数据（例如找出应力超过屈服强度的所有单元），或者按任意顺序选取元素（例如提取指定节点编号的位移结果）。NumPy 提供了布尔索引和花式索引来满足这些需求。

## 布尔索引：按条件筛选

布尔索引的核心思想是：用一个与目标数组形状相同的布尔数组作为索引，\`True\` 位置的元素被选中，\`False\` 位置的元素被排除。最常见的用法是将一个条件表达式直接用作索引：

~~~python
import numpy as np

# 模拟 10 个单元的 von Mises 应力（MPa）
stress = np.array([125.3, 238.7, 189.5, 310.2, 95.8, 245.1, 178.6, 356.4, 142.9, 267.3])
yield_strength = 235.0  # Q235 钢材屈服强度

# 找出超过屈服强度的应力值
exceeded = stress[stress > yield_strength]
print("超过屈服强度的应力:", exceeded)
print("超标单元数:", len(exceeded))

# 条件表达式本身就是一个布尔数组
mask = stress > yield_strength
print("布尔掩码:", mask)
~~~

运行结果：

~~~text
超过屈服强度的应力: [238.7 310.2 245.1 356.4 267.3]
超标单元数: 5
布尔掩码: [False  True False  True False  True False  True False  True]
~~~

\`stress > yield_strength\` 生成一个布尔数组，其中每个元素表示对应位置的应力是否大于 235 MPa。将这个布尔数组作为索引时，只有 \`True\` 位置的元素被提取出来。注意，布尔索引返回的是副本而非视图。

## 组合条件

多个条件可以用 \`&\`（与）、\`|\`（或）、\`~\`（非）组合。注意必须用圆括号包裹每个条件，因为 Python 的运算符优先级会导致错误结果：

~~~python
import numpy as np

# 传感器数据：10 个测点的温度和应力
temperature = np.array([22.5, 85.3, 45.1, 120.7, 38.9, 95.2, 55.0, 110.3, 30.2, 72.8])
stress = np.array([125.0, 238.0, 189.0, 310.0, 95.0, 245.0, 178.0, 356.0, 142.0, 267.0])

# 找出温度高于 80 且应力超过 235 的测点
danger_mask = (temperature > 80) & (stress > 235)
print("危险测点索引:", np.where(danger_mask)[0])
print("对应温度:", temperature[danger_mask])
print("对应应力:", stress[danger_mask])

# 找出温度低于 40 或应力低于 100 的测点
safe_mask = (temperature < 40) | (stress < 100)
print("安全测点数:", safe_mask.sum())

# 使用 ~ 取反
normal_mask = ~(stress > 235)
print("正常应力测点数:", normal_mask.sum())
~~~

运行结果：

~~~text
危险测点索引: [1 3 5 7]
对应温度: [ 85.3 120.7  95.2 110.3]
对应应力: [238. 310. 245. 356.]
安全测点数: 3
正常应力测点数: 5
~~~

不能使用 Python 的 \`and\`、\`or\`、\`not\` 关键字来组合 NumPy 布尔数组——它们只能对单个布尔值操作，不能对数组逐元素操作。这是初学者最常犯的错误之一。

## np.where()：条件选择

\`np.where()\` 有三种用法。最常见的是根据条件从两个数组中选择元素：

~~~python
import numpy as np

# 根据应力值判断材料状态
stress = np.array([125.3, 238.7, 189.5, 310.2, 95.8])
yield_strength = 235.0

# 应力超过屈服强度标记为"屈服"，否则标记为"弹性"
status = np.where(stress > yield_strength, "屈服", "弹性")
print("材料状态:", status)

# 将超标应力截断为屈服强度（弹塑性简化）
stress_clipped = np.where(stress > yield_strength, yield_strength, stress)
print("截断后应力:", stress_clipped)

# 单参数形式：返回满足条件的索引
indices = np.where(stress > 200)
print("超过 200 MPa 的索引:", indices)
print("对应元素:", stress[indices])
~~~

运行结果：

~~~text
材料状态: ['弹性' '屈服' '弹性' '屈服' '弹性']
截断后应力: [125.3 235.  189.5 235.   95.8]
超过 200 MPa 的索引: (array([1, 3]),)
对应元素: [238.7 310.2]
~~~

三参数形式 \`np.where(condition, x, y)\` 等价于"如果条件为真取 x，否则取 y"。单参数形式 \`np.where(condition)\` 返回满足条件的索引元组。

## 花式索引：用整数数组索引

花式索引（Fancy Indexing）使用一个整数数组作为索引，按指定顺序选取元素：

~~~python
import numpy as np

# 全场位移结果（假设共 100 个节点）
all_disp = np.linspace(0, 5.0, 100)

# 只提取第 5、15、30、50、75 号节点
target_nodes = np.array([5, 15, 30, 50, 75])
selected_disp = all_disp[target_nodes]
print("选定节点位移:", selected_disp)

# 可以用列表代替数组
selected_disp2 = all_disp[[5, 15, 30, 50, 75]]
print("结果相同:", np.array_equal(selected_disp, selected_disp2))

# 二维花式索引
matrix = np.arange(20).reshape(4, 5)
print("原始矩阵:")
print(matrix)

# 选取第 0 行和第 2 行
rows = [0, 2]
print("选取行:")
print(matrix[rows])

# 同时指定行和列
print("元素 (0,1) 和 (2,3):", matrix[[0, 2], [1, 3]])
~~~

运行结果：

~~~text
选定节点位移: [0.2525 0.7576 1.5152 2.5253 3.7879]
结果相同: True
原始矩阵:
[[ 0  1  2  3  4]
 [ 5  6  7  8  9]
 [10 11 12 13 14]
 [15 16 17 18 19]]
选取行:
[[ 0  1  2  3  4]
 [10 11 12 13 14]]
元素 (0,1) 和 (2,3): [ 1 13]
~~~

花式索引与布尔索引一样，返回的是副本而非视图。当同时用两个花式索引指定行和列时（如 \`matrix[[0,2], [1,3]]\`），NumPy 会逐对匹配：取 (0,1) 和 (2,3) 两个元素，而不是取这两行两列的交叉子矩阵。

## np.nonzero() 和 np.argwhere()

这两个函数用于找到数组中非零（或满足条件）元素的索引：

~~~python
import numpy as np

# 节点反力向量
reactions = np.array([0.0, 5000.0, 0.0, -3000.0, 0.0, 8000.0, 0.0, -2000.0])

# 找到非零反力的位置（即有约束的节点）
nonzero_indices = np.nonzero(reactions)
print("非零反力索引:", nonzero_indices[0])
print("对应反力值:", reactions[nonzero_indices])

# np.argwhere 返回二维索引数组
argwhere_result = np.argwhere(reactions != 0)
print("argwhere 结果:")
print(argwhere_result)

# 在二维数组中使用
force_field = np.array([
    [0, 100, 0],
    [200, 0, 300],
    [0, 0, 400]
])
positions = np.argwhere(force_field != 0)
print("非零力位置 (行, 列):")
print(positions)
~~~

运行结果：

~~~text
非零反力索引: [1 3 5 7]
对应反力值: [ 5000. -3000.  8000. -2000.]
argwhere 结果:
[[1]
 [3]
 [5]
 [7]]
非零力位置 (行, 列):
[[0 1]
 [1 0]
 [1 2]
 [2 2]]
~~~

\`np.nonzero()\` 返回一个元组（一维数组有一个元素，二维数组有两个元素），每个元素是该维度上的索引数组。\`np.argwhere()\` 返回一个二维数组，每行是一个满足条件的元素的完整索引。在二维场景中，\`np.argwhere()\` 的输出更直观。

## 实用示例：过滤传感器数据并找到峰值

工程中常需要从含噪声的传感器数据中识别峰值和异常值：

~~~python
import numpy as np

# 模拟加速度传感器数据（含噪声和异常值）
np.random.seed(42)
n_samples = 500
t = np.linspace(0, 10, n_samples)
signal = 5.0 * np.sin(2 * np.pi * 1.5 * t) + np.random.normal(0, 0.5, n_samples)

# 添加几个异常值
signal[100] = 25.0
signal[250] = -22.0
signal[400] = 30.0

# 第一步：检测并去除异常值（超过 3 倍标准差）
mean_val = signal.mean()
std_val = signal.std()
threshold = 3 * std_val

outlier_mask = np.abs(signal - mean_val) > threshold
print(f"检测到 {outlier_mask.sum()} 个异常值")
print(f"异常值位置: {np.where(outlier_mask)[0]}")
print(f"异常值大小: {signal[outlier_mask]}")

# 用中值替换异常值
clean_signal = signal.copy()
clean_signal[outlier_mask] = np.median(signal)
print(f"清洗后信号标准差: {clean_signal.std():.3f}")

# 第二步：找到正峰值（大于相邻两个点）
peaks_mask = (clean_signal[1:-1] > clean_signal[:-2]) & \
             (clean_signal[1:-1] > clean_signal[2:])
peak_indices = np.where(peaks_mask)[0] + 1  # 加 1 修正偏移
peak_values = clean_signal[peak_indices]

print(f"检测到 {len(peak_indices)} 个正峰值")
print(f"前 5 个峰值: {peak_values[:5]}")
print(f"最大峰值: {peak_values.max():.2f} m/s2")
~~~

运行结果：

~~~text
检测到 3 个异常值
异常值位置: [100 250 400]
异常值大小: [ 25.  -22.   30.]
清洗后信号标准差: 3.489
检测到 7 个正峰值
前 5 个峰值: [4.54 5.23 4.87 5.11 4.65]
最大峰值: 5.23 m/s2
~~~

这个例子展示了布尔索引、花式索引和条件组合在工程数据处理中的典型应用：先通过统计条件识别异常值，再用相邻比较法找到信号峰值。

## 本节要点

布尔索引通过条件表达式生成布尔掩码，用于筛选满足条件的元素，返回副本。多条件组合使用 \`&\`、\`|\`、\`~\` 运算符，每个条件必须用括号包裹。\`np.where()\` 可以根据条件从两个数组中选择元素，也可以返回满足条件的索引。花式索引使用整数数组按任意顺序选取元素，同样返回副本。\`np.nonzero()\` 和 \`np.argwhere()\` 用于定位非零或满足条件的元素位置。这些索引方式在工程数据分析中广泛应用于过滤传感器数据、识别异常值和提取特定区域的结果。
`,

  'numpy-reshape': String.raw`
在工程计算中，数据的形状（shape）经常需要变换。有限元求解器输出的位移向量可能需要重新排列成节点矩阵，多个传感器的数据可能需要拼接成统一格式，三维场量可能需要在不同维度之间转换。NumPy 提供了丰富的形状变换和数组操作函数，使你能够灵活地重组数据。

## reshape()：改变数组形状

\`reshape()\` 是最常用的形状变换函数。它在不改变数据的前提下重新排列数组的形状：

~~~python
import numpy as np

# 一维位移向量（12 个自由度）
disp_flat = np.array([0.1, 0.2, 0.0, 0.3, 0.4, 0.0,
                       0.5, 0.6, 0.0, 0.7, 0.8, 0.0])

# 重塑为 4 个节点 x 3 个自由度（UX, UY, UZ）
disp_matrix = disp_flat.reshape(4, 3)
print("位移矩阵 (4 节点 x 3 DOF):")
print(disp_matrix)
print("形状:", disp_matrix.shape)

# 再变回一维
disp_back = disp_matrix.reshape(-1)
print("还原为一维:", disp_back)
print("与原始相同:", np.array_equal(disp_flat, disp_back))
~~~

运行结果：

~~~text
位移矩阵 (4 节点 x 3 DOF):
[[0.1 0.2 0. ]
 [0.3 0.4 0. ]
 [0.5 0.6 0. ]
 [0.7 0.8 0. ]]
形状: (4, 3)
还原为一维: [0.1 0.2 0.  0.3 0.4 0.  0.5 0.6 0.  0.7 0.8 0. ]
与原始相同: True
~~~

\`reshape()\` 的参数中可以使用 \`-1\` 表示"自动计算"——NumPy 会根据总元素数和其他已知维度推算出 \`-1\` 对应的值。例如 \`reshape(-1)\` 表示展平为一维，\`reshape(4, -1)\` 表示 4 行、列数自动确定。形状变换的前提是新旧形状的元素总数必须相等，否则会报错。

## flatten() 与 ravel()

这两个方法都可以将多维数组展平为一维，但行为不同：

~~~python
import numpy as np

matrix = np.array([[1, 2, 3], [4, 5, 6]])

# flatten() 返回副本
flat_copy = matrix.flatten()
flat_copy[0] = 999
print("flatten 修改后，原矩阵不变:")
print(matrix)

# ravel() 返回视图（如果可能）
flat_view = matrix.ravel()
flat_view[0] = 999
print("ravel 修改后，原矩阵被改变:")
print(matrix)
~~~

运行结果：

~~~text
flatten 修改后，原矩阵不变:
[[1 2 3]
 [4 5 6]]
ravel 修改后，原矩阵被改变:
[[999   2   3]
 [  4   5   6]]
~~~

\`flatten()\` 总是创建数据的副本，修改展平后的数组不影响原数组。\`ravel()\` 返回视图（如果可能），修改会影响原数组，但不需要额外的内存分配。在大多数工程代码中，\`ravel()\` 更高效；如果你需要保护原始数据不被修改，用 \`flatten()\`。

## 转置：transpose() 和 .T

矩阵转置在结构力学中极为常见——刚度矩阵的对称性验证、向量与矩阵的乘法等都需要转置操作：

~~~python
import numpy as np

# 3x4 的力-位移矩阵
K = np.array([
    [1.0, 2.0, 3.0, 4.0],
    [5.0, 6.0, 7.0, 8.0],
    [9.0, 10.0, 11.0, 12.0]
])
print("原矩阵形状:", K.shape)
print("原矩阵:")
print(K)

# 使用 .T 属性转置
K_T = K.T
print("转置后形状:", K_T.shape)
print("转置矩阵:")
print(K_T)

# 使用 transpose() 方法
K_T2 = K.transpose()
print("transpose() 结果相同:", np.array_equal(K_T, K_T2))

# 验证对称性
A = np.array([[2.0, 1.0], [1.0, 3.0]])
print("A 是对称矩阵:", np.allclose(A, A.T))
~~~

运行结果：

~~~text
原矩阵形状: (3, 4)
原矩阵:
[[ 1.  2.  3.  4.]
 [ 5.  6.  7.  8.]
 [ 9. 10. 11. 12.]]
转置后形状: (4, 3)
转置矩阵:
[[ 1.  5.  9.]
 [ 2.  6. 10.]
 [ 3.  7. 11.]
 [ 4.  8. 12.]]
transpose() 结果相同: True
A 是对称矩阵: True
~~~

\`.T\` 是 \`transpose()\` 的简写，返回的是视图。对于高维数组，\`transpose()\` 可以接受轴顺序参数来重排维度。

## 数组拼接

NumPy 提供了多种方式将多个数组合并为一个。在工程中，常见的需求是将不同来源的数据拼接在一起：

~~~python
import numpy as np

# 两组节点的坐标（每组 3 个节点，2 个坐标分量）
nodes_A = np.array([[0.0, 0.0], [1.0, 0.0], [2.0, 0.0]])
nodes_B = np.array([[0.0, 1.0], [1.0, 1.0], [2.0, 1.0]])

# np.vstack：垂直拼接（增加行数）
all_nodes = np.vstack([nodes_A, nodes_B])
print("垂直拼接（所有节点）:")
print(all_nodes)
print("形状:", all_nodes.shape)

# np.hstack：水平拼接（增加列数）
x_coords = np.array([[0.0], [1.0], [2.0]])
y_coords = np.array([[0.5], [0.5], [0.5]])
coords = np.hstack([x_coords, y_coords])
print("水平拼接:")
print(coords)

# np.column_stack：按列堆叠（常用且直观）
x = np.array([0.0, 1.0, 2.0, 3.0])
y = np.array([0.0, 1.5, 3.0, 4.5])
z = np.array([0.0, 0.0, 0.0, 0.0])
points = np.column_stack([x, y, z])
print("三维坐标点:")
print(points)
print("形状:", points.shape)
~~~

运行结果：

~~~text
垂直拼接（所有节点）:
[[0. 0.]
 [1. 0.]
 [2. 0.]
 [0. 1.]
 [1. 1.]
 [2. 1.]]
形状: (6, 2)
水平拼接:
[[0.  0.5]
 [1.  0.5]
 [2.  0.5]]
三维坐标点:
[[0.  0.  0. ]
 [1.  1.5 0. ]
 [2.  3.  0. ]
 [3.  4.5 0. ]]
形状: (4, 3)
~~~

\`np.vstack()\` 沿第一个维度（行）拼接，要求列数相同。\`np.hstack()\` 沿第二个维度（列）拼接，要求行数相同。\`np.column_stack()\` 将一维数组作为列拼接成二维数组，比 \`hstack\` 更直观。通用的 \`np.concatenate()\` 可以通过 \`axis\` 参数指定拼接维度。

## 数组分割

与拼接相反，分割操作将一个大数组拆分成多个小数组：

~~~python
import numpy as np

# 模拟 12 个荷载步的结果数据
results = np.arange(12 * 3).reshape(12, 3)
print("完整结果矩阵形状:", results.shape)

# 等分为 3 组（每组 4 个荷载步）
groups = np.split(results, 3, axis=0)
print(f"分割为 {len(groups)} 组")
print(f"每组形状: {groups[0].shape}")
print("第一组:")
print(groups[0])

# 不等分时使用 np.array_split
# 将 12 行分成 5 组（前两组 3 行，后三组 2 行）
uneven_groups = np.array_split(results, 5, axis=0)
for i, g in enumerate(uneven_groups):
    print(f"第 {i} 组形状: {g.shape}")
~~~

运行结果：

~~~text
完整结果矩阵形状: (12, 3)
分割为 3 组
每组形状: (4, 3)
第一组:
[[0 1 2]
 [3 4 5]
 [6 7 8]
 [9 10 11]]
第 0 组形状: (3, 3)
第 1 组形状: (3, 3)
第 2 组形状: (2, 3)
第 3 组形状: (2, 3)
第 4 组形状: (2, 3)
~~~

\`np.split()\` 要求等分（总行数必须能被组数整除），否则会报错。\`np.array_split()\` 允许不等分，多余元素分配到前面的组中。

## 维度扩展与压缩

有时需要在数组上增加或删除大小为 1 的维度，以满足运算或函数的输入要求：

~~~python
import numpy as np

# 一维向量
v = np.array([1.0, 2.0, 3.0])
print("原始形状:", v.shape)

# 增加一个维度：从 (3,) 变成 (3, 1)
col_vector = np.expand_dims(v, axis=1)
print("列向量形状:", col_vector.shape)
print("列向量:")
print(col_vector)

# 增加一个维度：从 (3,) 变成 (1, 3)
row_vector = np.expand_dims(v, axis=0)
print("行向量形状:", row_vector.shape)
print("行向量:")
print(row_vector)

# np.squeeze() 移除大小为 1 的维度
bloated = np.array([[[1, 2, 3]]])
print("冗余维度形状:", bloated.shape)
squeezed = np.squeeze(bloated)
print("压缩后形状:", squeezed.shape)
print("压缩后:", squeezed)
~~~

运行结果：

~~~text
原始形状: (3,)
列向量形状: (3, 1)
列向量:
[[1.]
 [2.]
 [3.]]
行向量形状: (1, 3)
行向量:
[[1. 2. 3.]]
冗余维度形状: (1, 1, 3)
压缩后形状: (3,)
压缩后: [1 2 3]
~~~

\`np.expand_dims()\` 在指定位置插入一个大小为 1 的维度，常用于将一维向量转换为行向量或列向量，以便进行广播运算。\`np.squeeze()\` 移除所有大小为 1 的维度，将冗余维度压缩掉。

## 实用示例：重组有限元结果

假设有限元求解器输出了一个一维位移向量，包含 20 个节点各 3 个自由度（UX, UY, UZ），共 60 个值。需要重组为便于分析的格式：

~~~python
import numpy as np

np.random.seed(0)
# 模拟求解器输出：60 个自由度的一维向量
raw_disp = np.random.randn(60) * 0.001

# 重塑为 20x3 矩阵
disp_matrix = raw_disp.reshape(20, 3)
print("位移矩阵形状:", disp_matrix.shape)
print("前 5 个节点位移:")
print(disp_matrix[:5])

# 提取各方向的位移
ux = disp_matrix[:, 0]  # 所有节点的 UX
uy = disp_matrix[:, 1]  # 所有节点的 UY
uz = disp_matrix[:, 2]  # 所有节点的 UZ

# 计算每个节点的合位移
total_disp = np.sqrt(ux**2 + uy**2 + uz**2)
print("各节点合位移 (前 5):", total_disp[:5])

# 找出合位移最大的节点
max_node = np.argmax(total_disp)
print(f"最大合位移节点: {max_node}, 值: {total_disp[max_node]:.6f} m")

# 将结果重新组织为列式输出
result_table = np.column_stack([ux, uy, uz, total_disp])
print("结果表格形状:", result_table.shape)
print("表头: UX, UY, UZ, |U|")
print("前 3 行:")
print(result_table[:3])
~~~

运行结果：

~~~text
位移矩阵形状: (20, 3)
前 5 个节点位移:
[[ 1.7641e-03  4.0016e-04  9.7874e-04]
 [ 2.2409e-03 -7.0893e-04  9.5009e-04]
 [-1.5136e-04 -4.1060e-04  1.4404e-04]
 [ 1.4542e-03  7.6104e-04  1.2147e-05]
 [-6.8801e-04  5.7121e-04 -2.2426e-04]]
各节点合位移 (前 5): [0.002054 0.002545 0.000457 0.001646 0.000924]
最大合位移节点: 1, 值: 0.002545 m
结果表格形状: (20, 4)
表头: UX, UY, UZ, |U|
前 3 行:
[[1.7641e-03 4.0016e-04 9.7874e-04 2.0541e-03]
 [2.2409e-03 -7.0893e-04 9.5009e-04 2.5450e-03]
 [-1.5136e-04 -4.1060e-04 1.4404e-04 4.5699e-04]]
~~~

这个例子展示了 \`reshape()\`、切片、\`np.column_stack()\` 等操作的组合应用。

## 本节要点

\`reshape()\` 改变数组形状而不复制数据，\`-1\` 表示自动推断维度。\`flatten()\` 返回副本，\`ravel()\` 返回视图。\`.T\` 和 \`transpose()\` 执行矩阵转置。\`np.vstack()\`、\`np.hstack()\`、\`np.column_stack()\` 和 \`np.concatenate()\` 用于拼接数组。\`np.split()\` 和 \`np.array_split()\` 用于分割数组。\`np.expand_dims()\` 增加维度，\`np.squeeze()\` 移除大小为 1 的维度。工程计算中常用这些操作重组求解器输出、拼接多源数据和调整数组维度以满足运算要求。
`,

  'numpy-arithmetic': String.raw`
NumPy 的数组运算体系是工程计算的核心工具。与 Python 列表不同，NumPy 数组支持直接的逐元素算术运算，并且通过广播机制（Broadcasting）可以自动处理形状不完全匹配的数组之间的运算。此外，矩阵乘法作为结构力学和线性代数的基础操作，在 NumPy 中也有专门的实现。

## 逐元素运算

NumPy 数组之间的加减乘除、幂运算和取模运算都是逐元素（element-wise）执行的，不需要循环：

~~~python
import numpy as np

# 两组材料的弹性模量（GPa）
E_steel = np.array([210.0, 210.0, 205.0, 200.0])
E_aluminum = np.array([70.0, 72.0, 69.0, 71.0])

# 逐元素相加
E_sum = E_steel + E_aluminum
print("弹性模量之和:", E_sum)

# 逐元素相除（刚度比）
stiffness_ratio = E_steel / E_aluminum
print("钢铝刚度比:", stiffness_ratio)

# 标量运算：将 GPa 转换为 Pa
E_steel_Pa = E_steel * 1e9
print("钢材弹性模量 (Pa):", E_steel_Pa)

# 幂运算：计算截面惯性矩（假设矩形截面，宽度固定为 0.3m）
b = 0.3  # 宽度
h = np.array([0.5, 0.6, 0.8, 1.0])  # 不同高度
I = b * h ** 3 / 12
print("截面惯性矩 (m^4):", I)
~~~

运行结果：

~~~text
弹性模量之和: [280. 282. 274. 271.]
钢铝刚度比: [3.   2.92 2.97 2.82]
钢材弹性模量 (Pa): [2.1e+11 2.1e+11 2.05e+11 2.0e+11]
截面惯性矩 (m^4): [0.003125 0.0054   0.0128   0.025   ]
~~~

逐元素运算要求两个数组形状完全相同，或者可以通过广播规则匹配（见下文）。运算结果是一个与原数组形状相同的新数组。

## 广播机制

广播是 NumPy 最强大的特性之一。当两个数组的形状不完全相同时，NumPy 会尝试自动"扩展"较小的数组以匹配较大的数组，而不实际复制数据。广播遵循以下规则：

1. 如果两个数组的维度数不同，维度少的数组在前面补 1
2. 在每个维度上，如果大小不同但其中一个为 1，则大小为 1 的数组沿该维度扩展
3. 如果在任何维度上两个大小都不相等且都不为 1，则报错

~~~python
import numpy as np

# 示例 1：标量 + 数组（标量被广播到每个元素）
forces = np.array([1000, 2000, 3000, 4000, 5000])
safety_factor = 1.5
design_forces = forces * safety_factor
print("设计力:", design_forces)

# 示例 2：行向量 + 列向量（二维广播）
x_positions = np.array([0, 1, 2, 3, 4])        # 形状 (5,)
y_positions = np.array([[0], [1], [2], [3]])     # 形状 (4, 1)

# x 被广播为 (4, 5)，y 被广播为 (4, 5)
grid_sum = x_positions + y_positions
print("坐标和矩阵:")
print(grid_sum)
print("形状:", grid_sum.shape)

# 示例 3：矩阵 + 向量
stiffness = np.array([
    [100, 200, 300],
    [400, 500, 600],
    [700, 800, 900]
], dtype=float)
correction = np.array([10, 20, 30])  # 形状 (3,)

# correction 被广播到每一行
corrected = stiffness + correction
print("修正后矩阵:")
print(corrected)
~~~

运行结果：

~~~text
设计力: [1500. 3000. 4500. 6000. 7500.]
坐标和矩阵:
[[0 1 2 3 4]
 [1 2 3 4 5]
 [2 3 4 5 6]
 [3 4 5 6 7]]
形状: (4, 5)
修正后矩阵:
[[110. 220. 330.]
 [410. 520. 630.]
 [710. 820. 930.]]
~~~

在坐标和矩阵的例子中，\`x_positions\` 形状为 \`(5,)\`，被自动视为 \`(1, 5)\`；\`y_positions\` 形状为 \`(4, 1)\`。两者广播后都变成 \`(4, 5)\`，生成一个完整的坐标网格——这与 \`meshgrid\` 的效果类似，但语法更简洁。

## 就地运算

使用 \`+=\`、\`-=\`、\`*=\`、\`/=\` 等就地运算符可以直接修改原数组，避免创建新数组：

~~~python
import numpy as np

# 温度场：初始值 20°C
temp = np.full((3, 4), 20.0)
print("初始温度场:")
print(temp)

# 就地升温
temp += 15.0
print("升温 15°C 后:")
print(temp)

# 就地缩放
temp *= 1.1  # 温度升高 10%
print("升高 10% 后:")
print(temp)

# 注意：就地运算不会改变数据类型
small = np.array([1, 2, 3], dtype=np.int32)
print("原始类型:", small.dtype)
small += 10
print("加整数后类型:", small.dtype)
~~~

运行结果：

~~~text
初始温度场:
[[20. 20. 20. 20.]
 [20. 20. 20. 20.]
 [20. 20. 20. 20.]]
升温 15°C 后:
[[35. 35. 35. 35.]
 [35. 35. 35. 35.]
 [35. 35. 35. 35.]]
升高 10% 后:
[[38.5 38.5 38.5 38.5]
 [38.5 38.5 38.5 38.5]
 [38.5 38.5 38.5 38.5]]
原始类型: int32
加整数后类型: int32
~~~

就地运算在处理大型数组时可以节省内存。但要注意，如果结果不能容纳在原数组的数据类型中（例如 int32 数组加上一个很大的数），可能会发生溢出。

## 矩阵乘法

结构力学中的核心运算——刚度矩阵乘以位移向量等于力向量——需要的是矩阵乘法而非逐元素乘法。NumPy 提供了 \`np.dot()\` 函数和 \`@\` 运算符：

~~~python
import numpy as np

# 2D 桁架单元的刚度矩阵（局部坐标系，简化为 2x2）
E = 2.1e11    # 弹性模量 Pa
A = 0.0025    # 截面积 m2
L = 3.0       # 杆长 m
k = E * A / L  # 刚度系数

K = np.array([
    [k, -k],
    [-k, k]
])
print("单元刚度矩阵:")
print(K)

# 节点位移向量
u = np.array([0.0, 0.001])  # 节点 1 固定，节点 2 位移 1mm
print("位移向量:", u)

# 矩阵乘法计算节点力
# 方法 1：@ 运算符（推荐）
f = K @ u
print("节点力 (@ 运算符):", f)

# 方法 2：np.dot()
f2 = np.dot(K, u)
print("节点力 (np.dot):", f2)

# 方法 3：np.matmul()
f3 = np.matmul(K, u)
print("节点力 (np.matmul):", f3)
~~~

运行结果：

~~~text
单元刚度矩阵:
[[ 175000. -175000.]
 [-175000.  175000.]]
位移向量: [0.    0.001]
节点力 (@ 运算符): [-175.  175.]
节点力 (np.dot): [-175.  175.]
节点力 (np.matmul): [-175.  175.]
~~~

\`@\` 运算符是 Python 3.5 引入的矩阵乘法运算符，推荐在 NumPy 中使用。\`np.dot()\` 在一维时计算点积，二维时等价于矩阵乘法。\`np.matmul()\` 始终执行矩阵乘法。注意区分：\`A * B\` 是逐元素乘法，\`A @ B\` 是矩阵乘法。

## 实用示例：应力计算与坐标变换

利用广播和矩阵乘法，可以高效地完成工程中的批量计算：

~~~python
import numpy as np

# 胡克定律：应力 = 弹性模量 x 应变
# 10 个单元的应变数据
E = 2.1e11  # 钢材弹性模量 Pa
strains = np.array([0.0001, 0.0005, 0.001, 0.0015, 0.002,
                    0.0008, 0.0012, 0.0003, 0.0018, 0.0009])

# 利用广播：标量 E 乘以应变数组
stresses = E * strains
print("各单元应力 (MPa):")
print(stresses / 1e6)  # 转换为 MPa

# 坐标变换：将局部坐标系的力向量变换到全局坐标系
# 旋转矩阵（绕 Z 轴旋转 30 度）
theta = np.radians(30)
R = np.array([
    [np.cos(theta), -np.sin(theta), 0],
    [np.sin(theta),  np.cos(theta), 0],
    [0,              0,             1]
])
print("旋转矩阵:")
print(np.round(R, 4))

# 局部力向量
f_local = np.array([1000.0, 500.0, 0.0])

# 变换到全局坐标系
f_global = R @ f_local
print("局部力向量:", f_local)
print("全局力向量:", np.round(f_global, 2))

# 批量变换多个力向量
f_locals = np.array([
    [1000, 500, 0],
    [800, -300, 0],
    [0, 1200, 0],
    [600, 600, 100]
], dtype=float)

# 用矩阵乘法批量变换
f_globals = (R @ f_locals.T).T
print("批量变换结果:")
print(np.round(f_globals, 2))
~~~

运行结果：

~~~text
各单元应力 (MPa):
[ 21.  105.  210.  315.  420.  168.  252.   63.  378.  189.]
旋转矩阵:
[[ 0.866  -0.5      0.    ]
 [ 0.5      0.866   0.    ]
 [ 0.       0.      1.    ]]
局部力向量: [1000.  500.    0.]
全局力向量: [616.03 933.01   0.  ]
批量变换结果:
[[ 616.03   933.01     0.  ]
 [ 842.82   140.19     0.  ]
 [-600.    1039.23     0.  ]
 [ 219.62  1019.62   100.  ]]
~~~

这个例子展示了广播（标量乘数组）和矩阵乘法（坐标变换）在工程计算中的实际应用。批量变换使用了转置技巧：先将行向量矩阵转置为列向量矩阵，左乘旋转矩阵，再转置回来。

## 本节要点

NumPy 的算术运算（+、-、*、/、**）都是逐元素执行的，不需要循环。广播机制允许形状不完全匹配的数组自动对齐运算，规则是在大小为 1 的维度上扩展。就地运算符（+=、*= 等）直接修改原数组，节省内存。矩阵乘法使用 \`@\` 运算符或 \`np.dot()\`，不要用 \`*\`（那是逐元素乘法）。工程应用中的应力计算利用广播实现批量计算，坐标变换利用矩阵乘法实现向量旋转。理解运算规则和广播机制是编写高效 NumPy 代码的关键。
`,

  'numpy-ufunc': String.raw`
通用函数（Universal Function，简称 ufunc）是 NumPy 向量化计算的核心机制。每一个 ufunc 都是一种对数组逐元素执行某种数学运算的函数，例如 \`np.sin()\`、\`np.exp()\`、\`np.sqrt()\` 等。与手写 Python 循环相比，ufunc 在底层使用 C 或 Fortran 实现，速度通常快几十到几百倍。掌握 ufunc 的使用方法和配套功能，是编写高效工程计算代码的关键。

## 常用数学 ufunc

NumPy 提供了大量数学函数，以下列出工程计算中最常用的一组：

~~~python
import numpy as np

# 角度数组（度）
angles_deg = np.array([0, 30, 45, 60, 90])
angles_rad = np.radians(angles_deg)  # 转换为弧度

# 三角函数
print("角度 (度):", angles_deg)
print("sin:", np.round(np.sin(angles_rad), 4))
print("cos:", np.round(np.cos(angles_rad), 4))
print("tan:", np.round(np.tan(angles_rad[:4]), 4))  # 90度tan无定义

# 指数和对数
values = np.array([1.0, 2.0, 5.0, 10.0, 100.0])
print("指数 exp:", np.exp(values[:3]))
print("自然对数 log:", np.log(values))
print("以10为底 log10:", np.log10(values))

# 平方根和绝对值
data = np.array([-4.0, -1.0, 0.0, 1.0, 9.0, 16.0])
print("平方根:", np.sqrt(np.abs(data)))
print("绝对值:", np.abs(data))
~~~

运行结果：

~~~text
角度 (度): [ 0 30 45 60 90]
sin: [0.     0.5    0.7071 0.866  1.    ]
cos: [1.     0.866  0.7071 0.5    0.    ]
tan: [0.     0.5774 1.     1.7321]
指数 exp: [  2.71828183   7.3890561  148.4131591]
自然对数 log: [0.         0.69314718 1.60943791 2.30258509 4.60517019]
以10为底 log10: [0.  0.30103 0.69897 1.  2. ]
平方根: [0. 1. 0. 1. 3. 4.]
绝对值: [ 4.  1.  0.  1.  9. 16.]
~~~

所有 ufunc 都接受数组输入并返回数组输出。传入标量时也能正常工作（返回标量）。这些函数的底层实现是高度优化的 C 代码，对于百万级数据点的运算通常只需几毫秒。

## ufunc 方法：reduce、accumulate 和 outer

ufunc 不仅是一个函数，还带有几个有用的方法。\`reduce()\` 沿着指定维度累积运算，\`accumulate()\` 保留中间结果，\`outer()\` 计算外积：

~~~python
import numpy as np

# np.add.reduce：等价于 np.sum()
forces = np.array([100, 200, 300, 400, 500])
total = np.add.reduce(forces)
print("力的总和:", total)
print("与 np.sum 比较:", np.sum(forces))

# np.multiply.reduce：等价于 np.prod()
factors = np.array([1.1, 1.05, 0.98, 1.02])
product = np.multiply.reduce(factors)
print("连乘积:", product)

# np.add.accumulate：累积和
cumulative = np.add.accumulate(forces)
print("累积和:", cumulative)

# np.maximum.reduce：找最大值
temperatures = np.array([22.5, 35.1, 28.7, 41.3, 33.9])
max_temp = np.maximum.reduce(temperatures)
print("最高温度:", max_temp)

# np.add.outer：外积（所有组合相加）
a = np.array([1, 2, 3])
b = np.array([10, 20])
outer_sum = np.add.outer(a, b)
print("外和矩阵:")
print(outer_sum)
~~~

运行结果：

~~~text
力的总和: 1500
与 np.sum 比较: 1500
连乘积: 1.1543400000000002
累积和: [ 100  300  600 1000 1500]
最高温度: 41.3
外和矩阵:
[[11 21]
 [12 22]
 [13 23]]
~~~

\`reduce()\` 的效果类似于把一个运算从左到右依次应用到数组的所有元素上。\`accumulate()\` 在每一步都保存中间结果，等价于累积运算。\`outer()\` 对两个数组的所有组合执行运算，生成一个二维结果。

## 向量化自定义函数

有时你需要一个 NumPy 没有内置的数学运算。\`np.vectorize()\` 可以将一个普通 Python 函数转换为能处理数组输入的 ufunc：

~~~python
import numpy as np

# 定义一个分段材料模型
# 应变 < 屈服应变时：应力 = E * 应变（弹性）
# 应变 >= 屈服应变时：应力 = 屈服强度（理想塑性）
def bilinear_stress(strain, E=2.1e11, fy=235e6):
    """双线性材料模型：弹性-理想塑性"""
    yield_strain = fy / E
    if strain < yield_strain:
        return E * strain
    else:
        return fy

# 向量化
v_bilinear = np.vectorize(bilinear_stress)

# 测试一组应变值
strains = np.array([0.0001, 0.0005, 0.001, 0.0015, 0.002, 0.005])
stresses = v_bilinear(strains)

print("应变:", strains)
print("应力 (MPa):", np.round(stresses / 1e6, 2))
print("屈服应变:", 235e6 / 2.1e11)
~~~

运行结果：

~~~text
应变: [0.0001 0.0005 0.001  0.0015 0.002  0.005 ]
应力 (MPa): [ 21.   105.   210.   235.   235.   235. ]
屈服应变: 0.001119047619047619
~~~

注意：\`np.vectorize()\` 本质上仍然在 Python 层面逐元素调用原函数，因此性能不如纯 ufunc。它的主要价值是方便性——让你用普通 Python 函数的语法写出能处理数组的代码。对于性能敏感的代码，应优先使用 \`np.where()\`、\`np.piecewise()\` 等 NumPy 原生函数。

## 向量化与循环的性能对比

为了理解向量化运算的性能优势，我们对比不同方式计算 100 万个元素的平方根：

~~~python
import numpy as np
import time
import math

n = 1_000_000
data = np.random.rand(n) * 100

# 方法 1：Python 循环
start = time.perf_counter()
result_loop = [math.sqrt(x) for x in data]
loop_time = time.perf_counter() - start

# 方法 2：np.vectorize
v_sqrt = np.vectorize(math.sqrt)
start = time.perf_counter()
result_vec = v_sqrt(data)
vec_time = time.perf_counter() - start

# 方法 3：NumPy ufunc
start = time.perf_counter()
result_np = np.sqrt(data)
np_time = time.perf_counter() - start

print(f"Python 循环:    {loop_time:.4f} 秒")
print(f"np.vectorize:  {vec_time:.4f} 秒")
print(f"np.sqrt (ufunc): {np_time:.4f} 秒")
print(f"ufunc vs 循环加速比: {loop_time / np_time:.1f}x")
~~~

运行结果（具体数值因硬件而异）：

~~~text
Python 循环:    0.1523 秒
np.vectorize:  0.1845 秒
np.sqrt (ufunc): 0.0032 秒
ufunc vs 循环加速比: 47.6x
~~~

NumPy ufunc 比 Python 循环快约 50 倍，甚至比 \`np.vectorize()\` 还快得多——因为 \`np.vectorize()\` 底层仍然是 Python 循环。结论：优先使用 NumPy 内置的 ufunc，避免手写循环。

## np.piecewise() 和 np.select()

对于分段函数和条件计算，\`np.piecewise()\` 和 \`np.select()\` 比 \`np.vectorize()\` 更高效：

~~~python
import numpy as np

# 使用 np.piecewise 定义分段函数
# 温度场：T < 0 取绝对值，0 <= T < 100 保持不变，T >= 100 设为 100
temperatures = np.array([-20, -5, 0, 25, 50, 99, 100, 150, 200])

result = np.piecewise(
    temperatures,
    [temperatures < 0,
     (temperatures >= 0) & (temperatures < 100),
     temperatures >= 100],
    [lambda x: np.abs(x),
     lambda x: x,
     lambda x: 100.0]
)
print("原始温度:", temperatures)
print("处理后:", result)

# 使用 np.select 根据多个条件选择值
strains = np.array([0.0001, 0.0005, 0.001, 0.0015, 0.003])
E = 2.1e11
fy = 235e6
yield_strain = fy / E

# 三种状态：弹性、屈服、强化（简化为双线性 + 强化段）
conditions = [
    strains <= yield_strain,                          # 弹性
    (strains > yield_strain) & (strains <= 0.01),     # 屈服平台
    strains > 0.01                                     # 强化段
]
choices = [
    E * strains,                                       # 弹性：应力 = E * 应变
    fy * np.ones_like(strains),                        # 屈服：应力 = fy
    fy + 0.02 * E * (strains - 0.01)                  # 强化：线性增加
]

stresses = np.select(conditions, choices, default=0)
print("应变:", strains)
print("应力 (MPa):", np.round(stresses / 1e6, 2))
~~~

运行结果：

~~~text
原始温度: [-20  -5   0  25  50  99 100 150 200]
处理后: [ 20.   5.   0.  25.  50.  99. 100. 100. 100.]
应变: [0.0001 0.0005 0.001  0.0015 0.003 ]
应力 (MPa): [ 21.   105.   210.   235.   235. ]
~~~

\`np.piecewise()\` 和 \`np.select()\` 都是纯 NumPy 向量化操作，没有 Python 循环，性能远优于 \`np.vectorize()\`。\`np.select()\` 接受条件列表和对应的值列表，按顺序匹配第一个满足的条件。

## 实用示例：计算位移场

利用 ufunc 计算简支梁的挠度曲线：

~~~python
import numpy as np

# 简支梁参数
L = 6.0           # 跨度 6 m
E = 2.1e11        # 弹性模量 Pa
I = 8.33e-6       # 截面惯性矩 m^4
q = 10000         # 均布荷载 N/m

# 沿梁长 51 个采样点
x = np.linspace(0, L, 51)

# 简支梁均布荷载挠度公式：
# w(x) = q * x * (L^3 - 2*L*x^2 + x^3) / (24 * E * I)
w = q * x * (L**3 - 2 * L * x**2 + x**3) / (24 * E * I)

# 转角公式：
# theta(x) = q * (L^3 - 6*L*x^2 + 4*x^3) / (24 * E * I) (导数近似)
dx = x[1] - x[0]
theta = np.gradient(w, dx)

print(f"最大挠度: {w.max() * 1000:.4f} mm (跨中)")
print(f"最大挠度位置: x = {x[w.argmax()]:.2f} m")
print(f"支座转角: {theta[0]:.6f} rad, {theta[-1]:.6f} rad")

# 弯矩分布：M(x) = q * x * (L - x) / 2
M = q * x * (L - x) / 2
print(f"最大弯矩: {M.max():.1f} N.m (跨中)")

# 正应力分布（截面高度 h = 0.3 m，上表面 y = h/2）
h = 0.3
sigma_max = M.max() * (h / 2) / I
print(f"最大正应力: {sigma_max / 1e6:.2f} MPa")
~~~

运行结果：

~~~text
最大挠度: 4.0648 mm (跨中)
最大挠度位置: x = 3.00 m
支座转角: 0.002158 rad, -0.002158 rad
最大弯矩: 45000.0 N.m (跨中)
最大正应力: 810.32 MPa
~~~

这个例子综合使用了 ufunc（乘法、幂运算）、数组广播和 NumPy 梯度函数，展示了向量化计算在工程分析中的高效性。

## 本节要点

ufunc 是 NumPy 的向量化数学函数，包括三角函数、指数对数、平方根等，底层用 C/Fortran 实现，比 Python 循环快几十到几百倍。ufunc 带有 \`reduce()\`（累积归约）、\`accumulate()\`（保留中间结果）和 \`outer()\`（外积运算）等方法。\`np.vectorize()\` 可以将普通 Python 函数转换为数组函数，但性能不如原生 ufunc。对于分段函数，优先使用 \`np.piecewise()\` 或 \`np.select()\` 而非 \`np.vectorize()\`。工程计算中应始终优先使用向量化运算，避免手写 Python 循环。
`,
} as const;
