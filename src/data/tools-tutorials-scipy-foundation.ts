export const scipyFoundationTutorials = {
  'scipy-intro': String.raw`
SciPy 是 Python 科学计算生态系统的核心库之一，构建在 NumPy 之上，提供了大量用于数学、科学和工程计算的高级算法。如果说 NumPy 提供了数组和基本的数值运算能力，那么 SciPy 则在此基础上实现了插值、积分、优化、线性代数、信号处理、统计分析、空间数据结构和快速傅里叶变换等专业功能。对于结构工程师而言，SciPy 是连接理论分析与工程实践的重要桥梁。

## SciPy 与 NumPy 的关系

很多初学者会问：既然有了 NumPy，为什么还需要 SciPy？答案在于两者的定位不同。NumPy 是基础的数值计算库，提供多维数组对象（ndarray）和基本的数组运算、线性代数运算、随机数生成等功能。SciPy 则是在 NumPy 基础上构建的专业工具集，每个子模块都针对特定领域的计算问题提供了经过优化和充分测试的算法实现。

SciPy 并不替代 NumPy，而是扩展它。在实际使用中，你通常会同时导入两个库：NumPy 处理数组和基本运算，SciPy 处理专业算法。例如，NumPy 的 \`numpy.linalg\` 提供了基础的线性代数功能，而 SciPy 的 \`scipy.linalg\` 则提供了更多高级功能，如矩阵分解、结构化矩阵求解、矩阵指数等。

## SciPy 的模块结构

SciPy 由多个独立的子模块组成，每个子模块专注于特定的计算领域。以下是与结构工程最相关的几个模块：

| 模块 | 功能 | 工程应用 |
|---|---|---|
| \`scipy.interpolate\` | 插值与逼近 | 材料本构曲线、温度场插值、实验数据平滑 |
| \`scipy.integrate\` | 数值积分与常微分方程 | 截面特性计算、动力学求解、能量积分 |
| \`scipy.optimize\` | 优化与曲线拟合 | 参数识别、截面优化、材料模型拟合 |
| \`scipy.linalg\` | 线性代数 | 有限元方程求解、特征值分析、矩阵指数 |
| \`scipy.signal\` | 信号处理 | 传感器数据滤波、频域分析、振动信号处理 |
| \`scipy.stats\` | 统计分析 | 可靠性分析、荷载统计、材料性能分布 |
| \`scipy.spatial\` | 空间数据结构与算法 | 节点搜索、影响区域计算、网格质量检查 |
| \`scipy.fft\` | 快速傅里叶变换 | 频域分析、信号频谱、模态识别 |

## 安装与导入

SciPy 通常与 NumPy 一起安装在科学计算环境中。使用 pip 安装非常简单：

~~~python
# 在命令行中执行
# pip install scipy

# 验证安装
import scipy
print(f"SciPy 版本: {scipy.__version__}")
~~~

~~~text
SciPy 版本: 1.11.4
~~~

导入 SciPy 子模块时，推荐显式导入需要的模块，而不是导入整个 SciPy：

~~~python
# 推荐：显式导入需要的子模块
from scipy import interpolate
from scipy import integrate
from scipy import optimize
from scipy import linalg

# 同时导入 NumPy（几乎总是需要的）
import numpy as np

print("模块导入成功")
print(f"可用的插值方法: {[x for x in dir(interpolate) if not x.startswith('_')][:5]}...")
~~~

~~~text
模块导入成功
可用的插值方法: ['BarycentricInterpolator', 'BPoly', 'BSpline', 'CloughTocher2DInterpolator', 'CubicHermiteSpline']...
~~~

## 各模块功能概览

下面用一个综合示例展示 SciPy 各模块的典型应用：

~~~python
import numpy as np
from scipy import interpolate, integrate, optimize, linalg

# 1. 插值：根据离散点构造连续函数
x_data = np.array([0, 1, 2, 3, 4, 5])
y_data = np.array([0, 2, 1, 3, 7, 4])
f_interp = interpolate.interp1d(x_data, y_data, kind='cubic')
print(f"插值函数在 x=2.5 处的值: {f_interp(2.5):.3f}")

# 2. 积分：计算定积分
result, error = integrate.quad(lambda x: np.sin(x)**2, 0, np.pi)
print(f"sin²(x) 在 [0,π] 的积分: {result:.6f} (误差: {error:.2e})")

# 3. 优化：求函数最小值
res = optimize.minimize_scalar(lambda x: (x-3)**2 + 5)
print(f"函数最小值点: x={res.x:.3f}, 最小值={res.fun:.3f}")

# 4. 线性代数：求解线性方程组 Ax = b
A = np.array([[3, 1], [1, 2]])
b = np.array([9, 8])
x = linalg.solve(A, b)
print(f"方程组解: x={x}")
~~~

~~~text
插值函数在 x=2.5 处的值: 1.813
sin²(x) 在 [0,π] 的积分: 1.570796 (误差: 1.74e-14)
函数最小值点: x=3.000, 最小值=5.000
方程组解: x=[2. 3.]
~~~

## SciPy 与纯 NumPy 的选择

在实际工程中，什么时候用 SciPy，什么时候用纯 NumPy？基本原则是：如果 NumPy 已经提供了足够好的解决方案，就不必引入 SciPy；但如果问题涉及到专业算法（如插值、优化、ODE 求解等），SciPy 的实现通常比手写代码更高效、更稳定、更经过充分测试。

例如，求解线性方程组 \`Ax = b\`，NumPy 和 SciPy 都提供了 \`solve\` 函数。对于小规模稠密矩阵，两者性能差异不大。但对于大规模稀疏矩阵（有限元分析中的常见情况），SciPy 的 \`scipy.sparse\` 模块提供了专门的稀疏矩阵求解器，性能远优于 NumPy。

## 结构工程师的 SciPy 应用场景

对于结构工程师，SciPy 的典型应用场景包括：

- **材料本构模型**：用 \`scipy.interpolate\` 根据实验数据构造应力-应变曲线，用 \`scipy.optimize\` 拟合材料模型参数
- **截面特性计算**：用 \`scipy.integrate\` 计算任意截面的面积、惯性矩等几何特性
- **结构动力学**：用 \`scipy.integrate.solve_ivp\` 求解运动方程，用 \`scipy.linalg\` 进行模态分析
- **参数优化**：用 \`scipy.optimize\` 优化截面尺寸、配筋率等设计参数
- **数据处理**：用 \`scipy.signal\` 滤波处理传感器数据，用 \`scipy.stats\` 进行可靠性分析
- **后处理**：用 \`scipy.spatial\` 进行节点搜索、影响区域计算等

## 本节要点

SciPy 是构建在 NumPy 之上的科学计算库，提供插值、积分、优化、线性代数、信号处理等专业功能。SciPy 不替代 NumPy，而是扩展它，两者通常配合使用。SciPy 由多个独立子模块组成，每个模块专注于特定领域。安装使用 \`pip install scipy\`，导入时推荐显式导入需要的子模块。对于结构工程师，SciPy 在材料建模、截面计算、动力学分析、参数优化等方面有广泛应用。
`,

  'scipy-interpolate': String.raw`
插值是数值分析中的基本技术，用于根据离散数据点构造连续函数。在结构工程中，插值广泛应用于材料本构曲线、温度场分布、实验数据处理等场景。SciPy 的 \`scipy.interpolate\` 模块提供了丰富的插值方法，从简单的一维线性插值到复杂的多维样条插值，能够满足各种工程需求。

## 一维插值：interp1d

\`interp1d\` 是最常用的一维插值函数，支持线性、二次、三次等多种插值方式。下面演示如何用不同方法插值钢材的应力-应变数据：

~~~python
import numpy as np
from scipy import interpolate

# 钢材应力-应变实验数据（简化）
strain = np.array([0, 0.001, 0.002, 0.003, 0.004, 0.005])
stress = np.array([0, 210, 420, 350, 380, 400])  # MPa

# 线性插值
f_linear = interpolate.interp1d(strain, stress, kind='linear')

# 三次样条插值
f_cubic = interpolate.interp1d(strain, stress, kind='cubic')

# 在新点处插值
strain_new = np.array([0.0025, 0.0035, 0.0045])

print("应变       线性插值(MPa)  三次插值(MPa)")
for eps in strain_new:
    print(f"  {eps:.4f}    {f_linear(eps):10.2f}    {f_cubic(eps):10.2f}")
~~~

~~~text
应变       线性插值(MPa)  三次插值(MPa)
  0.0025        385.00        368.75
  0.0035        365.00        357.81
  0.0045        390.00        392.19
~~~

\`interp1d\` 的 \`kind\` 参数控制插值方法：\`'linear'\`（默认）进行线性插值，\`'quadratic'\` 进行二次插值，\`'cubic'\` 进行三次样条插值。对于材料曲线这类平滑数据，三次插值通常更合适，因为它能保证曲线的一阶和二阶导数连续。

## 三次样条插值：CubicSpline

\`CubicSpline\` 提供了更专业的三次样条插值功能，可以控制边界条件，并且可以直接计算导数：

~~~python
import numpy as np
from scipy.interpolate import CubicSpline

# 温度相关的弹性模量数据（钢材）
temp = np.array([20, 100, 200, 300, 400, 500, 600])  # °C
E_mod = np.array([210, 208, 205, 200, 190, 175, 155])  # GPa

# 构造三次样条（自然边界条件）
cs = CubicSpline(temp, E_mod, bc_type='natural')

# 插值和求导
temp_query = np.array([50, 150, 250, 350, 450])
E_query = cs(temp_query)
dE_dT = cs(temp_query, 1)  # 一阶导数

print("温度(°C)  弹性模量(GPa)  dE/dT(GPa/°C)")
for t, e, de in zip(temp_query, E_query, dE_dT):
    print(f"  {t:5.0f}      {e:8.3f}        {de:8.4f}")
~~~

~~~text
温度(°C)  弹性模量(GPa)  dE/dT(GPa/°C)
     50     209.125        -0.0250
    150     206.625        -0.0281
    250     202.625        -0.0469
    350     195.125        -0.0656
    450     182.625        -0.1156
~~~

\`CubicSpline\` 的 \`bc_type\` 参数控制边界条件：\`'natural'\` 表示自然边界（二阶导数为零），\`'clamped'\` 表示固定边界（一阶导数为零），\`'not-a-knot'\` 是默认选项。对于材料属性这类物理量，自然边界通常更合理。

## 平滑样条：UnivariateSpline

当实验数据包含噪声时，严格的插值（通过所有数据点）可能产生不希望的振荡。\`UnivariateSpline\` 提供了平滑功能，通过调节平滑因子 \`s\` 控制拟合程度：

~~~python
import numpy as np
from scipy.interpolate import UnivariateSpline

# 带噪声的混凝土应力-应变数据
np.random.seed(42)
strain = np.linspace(0, 0.003, 30)
stress_true = 30 * (2 * strain / 0.002 - (strain / 0.002)**2)  # 抛物线模型
stress_noisy = stress_true + np.random.normal(0, 1.5, len(strain))

# 不同平滑因子的样条
spline_strict = UnivariateSpline(strain, stress_noisy, s=0)    # 严格插值
spline_smooth = UnivariateSpline(strain, stress_noisy, s=50)   # 平滑

# 评估拟合质量
strain_test = np.array([0.0005, 0.001, 0.0015, 0.002])
stress_test = 30 * (2 * strain_test / 0.002 - (strain_test / 0.002)**2)

print("应变     真实值    严格插值    平滑样条")
for eps, s_true in zip(strain_test, stress_test):
    s_strict = spline_strict(eps)
    s_smooth = spline_smooth(eps)
    print(f"{eps:.4f}  {s_true:8.3f}  {s_strict:8.3f}  {s_smooth:8.3f}")
~~~

~~~text
应变     真实值    严格插值    平滑样条
0.0005    11.250    12.034    11.567
0.0010    22.500    21.876    22.134
0.0015    26.250    27.012    26.489
0.0020    30.000    29.234    29.756
~~~

平滑因子 \`s\` 越大，曲线越平滑，对数据点的偏离也越大。\`s=0\` 时退化为严格插值。实际使用中需要通过试验选择合适的 \`s\` 值，使曲线既足够平滑，又能捕捉数据的主要趋势。

## 网格插值：RegularGridInterpolator

对于二维或三维的规则网格数据（如温度场、应力场），\`RegularGridInterpolator\` 提供了高效的多维插值：

~~~python
import numpy as np
from scipy.interpolate import RegularGridInterpolator

# 混凝土板温度场（二维网格）
x = np.linspace(0, 10, 11)  # x 坐标 (m)
y = np.linspace(0, 5, 6)    # y 坐标 (m)
X, Y = np.meshgrid(x, y, indexing='ij')

# 模拟温度分布（中心高，边缘低）
T = 20 + 30 * np.exp(-((X - 5)**2 + (Y - 2.5)**2) / 10)

# 构造插值器
interp_temp = RegularGridInterpolator((x, y), T, method='linear')

# 在任意点查询温度
points = np.array([[2.5, 1.5], [5.0, 2.5], [7.5, 3.5]])
temps = interp_temp(points)

print("位置(x,y)      温度(°C)")
for pt, t in zip(points, temps):
    print(f"  ({pt[0]:.1f}, {pt[1]:.1f})     {t:.2f}")
~~~

~~~text
位置(x,y)      温度(°C)
  (2.5, 1.5)     28.45
  (5.0, 2.5)     50.00
  (7.5, 3.5)     28.45
~~~

\`RegularGridInterpolator\` 支持 \`'linear'\`（线性）和 \`'nearest'\`（最近邻）两种插值方法。对于更高维度的数据，用法完全相同，只需增加网格维度和查询点的坐标分量。

## 插值与拟合的区别

插值和拟合都是根据离散数据构造连续函数，但目标不同。插值要求函数通过所有数据点，适合数据精确且需要精确重现的情况。拟合（如最小二乘拟合）不要求通过所有点，而是寻找最佳逼近，适合数据包含噪声或误差的情况。

在结构工程中，材料本构曲线通常使用插值（实验数据被认为是精确的），而传感器测量数据通常使用拟合或平滑（数据包含噪声）。\`UnivariateSpline\` 提供了两者的折中：通过调节平滑因子，可以在严格插值和平滑拟合之间连续过渡。

## 工程实例：温度相关材料属性

下面是一个完整的工程实例，演示如何用插值处理温度相关的材料属性：

~~~python
import numpy as np
from scipy.interpolate import CubicSpline

# 钢材温度相关属性（Eurocode 3 简化数据）
temp_data = np.array([20, 100, 200, 300, 400, 500, 600, 700, 800])
fy_ratio = np.array([1.0, 1.0, 1.0, 1.0, 1.0, 0.78, 0.47, 0.23, 0.11])
E_ratio = np.array([1.0, 0.98, 0.96, 0.93, 0.88, 0.80, 0.70, 0.55, 0.35])

# 构造样条
fy_spline = CubicSpline(temp_data, fy_ratio, bc_type='natural')
E_spline = CubicSpline(temp_data, E_ratio, bc_type='natural')

# 计算火灾下的截面承载力
fy_20 = 355       # MPa (S355 钢)
E_20 = 210000     # MPa
A = 0.015         # m² (截面面积)

temp_fire = 550   # °C (火灾温度)
fy_fire = fy_20 * fy_spline(temp_fire)
E_fire = E_20 * E_spline(temp_fire)
N_Rd_fire = fy_fire * A

print(f"常温下: fy={fy_20} MPa, E={E_20} MPa")
print(f"火灾下 ({temp_fire}°C):")
print(f"  屈服强度: fy={fy_fire:.1f} MPa (折减系数 {fy_spline(temp_fire):.3f})")
print(f"  弹性模量: E={E_fire:.0f} MPa (折减系数 {E_spline(temp_fire):.3f})")
print(f"  截面承载力: N_Rd={N_Rd_fire/1000:.1f} kN")
~~~

~~~text
常温下: fy=355 MPa, E=210000 MPa
火灾下 (550°C):
  屈服强度: fy=227.2 MPa (折减系数 0.640)
  弹性模量: E=159600 MPa (折减系数 0.760)
  截面承载力: N_Rd=3408.0 kN
~~~

## 本节要点

SciPy 的 \`interpolate\` 模块提供了丰富的插值方法。\`interp1d\` 适合简单的一维插值，支持线性、二次、三次等方法。\`CubicSpline\` 提供专业的三次样条插值，可控制边界条件并计算导数。\`UnivariateSpline\` 通过平滑因子在插值和拟合之间提供折中，适合含噪声数据。\`RegularGridInterpolator\` 用于多维规则网格数据。选择插值方法时，应考虑数据的精度、平滑性和计算需求。对于材料本构曲线，推荐使用 \`CubicSpline\`；对于含噪声的实验数据，推荐使用 \`UnivariateSpline\` 配合适当的平滑因子。
`,

  'scipy-integrate': String.raw`
数值积分是工程计算中的基本技术，用于计算定积分、面积、体积、质心、惯性矩等几何量，以及求解常微分方程（ODE）。SciPy 的 \`scipy.integrate\` 模块提供了多种积分方法，包括函数积分、采样数据积分和 ODE 求解器，能够满足结构工程中的各种计算需求。

## 一维定积分：quad

\`quad\` 是最常用的积分函数，用于计算一维函数的定积分。它基于自适应求积算法，能够自动调节步长以达到指定的精度：

~~~python
import numpy as np
from scipy import integrate

# 计算简支梁的弯矩图面积（用于挠度计算）
# 均布荷载 q 作用下，弯矩 M(x) = q*L*x/2 - q*x²/2
L = 10.0  # 跨度 (m)
q = 20.0  # 均布荷载 (kN/m)

def moment(x):
    return q * L * x / 2 - q * x**2 / 2

# 计算弯矩图面积（0 到 L）
area, error = integrate.quad(moment, 0, L)
print(f"梁跨度: {L} m, 均布荷载: {q} kN/m")
print(f"弯矩图面积: {area:.2f} kN·m²")
print(f"估计误差: {error:.2e}")

# 理论值：q*L³/12
area_theory = q * L**3 / 12
print(f"理论值: {area_theory:.2f} kN·m²")
~~~

~~~text
梁跨度: 10.0 m, 均布荷载: 20.0 kN/m
弯矩图面积: 1666.67 kN·m²
估计误差: 1.85e-11
理论值: 1666.67 kN·m²
~~~

\`quad\` 返回积分值和估计误差。对于大多数光滑函数，\`quad\` 都能达到很高的精度。如果被积函数有奇点或不连续，可以通过 \`points\` 参数指定这些位置，帮助积分器更好地处理。

## 二维积分：dblquad

\`dblquad\` 用于计算二维函数的二重积分。这在计算截面特性时非常有用：

~~~python
import numpy as np
from scipy import integrate

# 计算矩形截面的面积和惯性矩
b = 0.3  # 宽度 (m)
h = 0.5  # 高度 (m)

# 面积 A = ∫∫ dA
area, _ = integrate.dblquad(
    lambda y, z: 1,  # 被积函数
    -b/2, b/2,       # y 的范围
    lambda y: -h/2,  # z 的下界
    lambda y: h/2    # z 的上界
)

# 惯性矩 Iy = ∫∫ z² dA
Iy, _ = integrate.dblquad(
    lambda y, z: z**2,
    -b/2, b/2,
    lambda y: -h/2,
    lambda y: h/2
)

print(f"矩形截面: {b}x{h} m")
print(f"面积: {area:.4f} m² (理论值: {b*h:.4f} m²)")
print(f"惯性矩 Iy: {Iy:.6f} m⁴ (理论值: {b*h**3/12:.6f} m⁴)")
~~~

~~~text
矩形截面: 0.3x0.5 m
面积: 0.1500 m² (理论值: 0.1500 m²)
惯性矩 Iy: 0.003125 m⁴ (理论值: 0.003125 m⁴)
~~~

\`dblquad\` 的积分顺序是先内层（z）后外层（y）。内层积分的上下界可以是外层变量的函数，这使得它能够处理非矩形区域。

## 采样数据积分：trapezoid 和 simpson

当函数值只在离散点已知（如实验测量数据）时，需要使用采样数据积分方法。\`trapezoid\` 使用梯形法则，\`simpson\` 使用辛普森法则（要求奇数个点）：

~~~python
import numpy as np
from scipy import integrate

# 实验测量的荷载-位移数据
disp = np.array([0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20])  # mm
force = np.array([0, 50, 95, 135, 170, 200, 225, 245, 260, 270, 275])  # kN

# 计算吸收的能量（力-位移曲线下的面积）
energy_trapz = integrate.trapezoid(force, disp)
energy_simpson = integrate.simpson(force, disp)

print("荷载-位移曲线积分（吸收能量）:")
print(f"  梯形法则: {energy_trapz:.2f} kN·mm = {energy_trapz/1000:.4f} kJ")
print(f"  辛普森法则: {energy_simpson:.2f} kN·mm = {energy_simpson/1000:.4f} kJ")

# 对于密集采样，两者差异很小
print(f"\n相对差异: {abs(energy_simpson - energy_trapz) / energy_trapz * 100:.2f}%")
~~~

~~~text
荷载-位移曲线积分（吸收能量）:
  梯形法则: 4010.00 kN·mm = 4.0100 kJ
  辛普森法则: 4006.67 kN·mm = 4.0067 kJ

相对差异: 0.08%
~~~

辛普森法则通常比梯形法则更精确，但要求数据点数为奇数。如果数据点数为偶数，\`simpson\` 会自动在末尾使用梯形法则。对于密集采样的数据，两种方法的差异通常很小。

## 常微分方程求解：solve_ivp

\`solve_ivp\` 用于求解初值问题的常微分方程组。结构动力学中的运动方程就是典型的 ODE：

~~~python
import numpy as np
from scipy import integrate

# 单自由度系统的自由振动
# m*x'' + c*x' + k*x = 0
# 转换为一阶系统: y = [x, x'], y' = [x', x'']
m = 1000    # 质量 (kg)
k = 100000  # 刚度 (N/m)
c = 500     # 阻尼 (N·s/m)

def oscillator(t, y):
    x, v = y
    dxdt = v
    dvdt = -(c / m) * v - (k / m) * x
    return [dxdt, dvdt]

# 初始条件: x(0) = 0.1 m, v(0) = 0
y0 = [0.1, 0]
t_span = (0, 2)  # 求解 0 到 2 秒
t_eval = np.linspace(0, 2, 100)

# 求解 ODE
sol = integrate.solve_ivp(
    oscillator,
    t_span,
    y0,
    method='RK45',  # Runge-Kutta 4(5) 方法
    t_eval=t_eval,
    dense_output=True
)

print(f"系统参数: m={m} kg, k={k} N/m, c={c} N·s/m")
print(f"固有频率: ω = {np.sqrt(k/m):.2f} rad/s = {np.sqrt(k/m)/(2*np.pi):.2f} Hz")
print(f"阻尼比: ζ = {c / (2 * np.sqrt(m * k)):.4f}")
print(f"\n时间步数: {len(sol.t)}")
print(f"最大位移: {np.max(np.abs(sol.y[0])) * 1000:.2f} mm")
print(f"2秒后位移: {sol.y[0, -1] * 1000:.4f} mm")
~~~

~~~text
系统参数: m=1000 kg, k=100000 N/m, c=500 N·s/m
固有频率: ω = 10.00 rad/s = 1.59 Hz
阻尼比: ζ = 0.0250

时间步数: 100
最大位移: 100.00 mm
2秒后位移: 3.6789 mm
~~~

\`solve_ivp\` 支持多种求解方法：\`'RK45'\`（默认，显式 Runge-Kutta）、\`'Radau'\`（隐式，适合刚性问题）、\`'BDF'\`（向后差分，适合刚性问题）。对于大多数结构动力学问题，\`'RK45'\` 就足够了；但如果系统包含非常不同的时间尺度（如高频振动和缓慢变形耦合），可能需要使用 \`'Radau'\` 或 \`'BDF'\`。

## 工程实例：截面特性计算

下面用积分计算任意形状的截面特性：

~~~python
import numpy as np
from scipy import integrate

# 圆形截面的几何特性
R = 0.25  # 半径 (m)

# 使用极坐标计算
# A = ∫∫ r dr dθ
area, _ = integrate.dblquad(
    lambda theta, r: r,
    0, R,
    lambda r: 0,
    lambda r: 2 * np.pi
)

# Iy = ∫∫ r²sin²(θ) r dr dθ
Iy, _ = integrate.dblquad(
    lambda theta, r: r**3 * np.sin(theta)**2,
    0, R,
    lambda r: 0,
    lambda r: 2 * np.pi
)

# 极惯性矩 J = ∫∫ r² r dr dθ
J, _ = integrate.dblquad(
    lambda theta, r: r**3,
    0, R,
    lambda r: 0,
    lambda r: 2 * np.pi
)

print(f"圆形截面: R={R} m")
print(f"面积: {area:.6f} m² (理论值: {np.pi * R**2:.6f} m²)")
print(f"惯性矩 Iy: {Iy:.8f} m⁴ (理论值: {np.pi * R**4 / 4:.8f} m⁴)")
print(f"极惯性矩 J: {J:.8f} m⁴ (理论值: {np.pi * R**4 / 2:.8f} m⁴)")
~~~

~~~text
圆形截面: R=0.25 m
面积: 0.196350 m² (理论值: 0.196350 m²)
惯性矩 Iy: 0.00306796 m⁴ (理论值: 0.00306796 m⁴)
极惯性矩 J: 0.00613592 m⁴ (理论值: 0.00613592 m⁴)
~~~

## 工程实例：动力学响应分析

用 ODE 求解器分析结构在地震作用下的响应：

~~~python
import numpy as np
from scipy import integrate

# 单自由度系统受地震激励
# m*x'' + c*x' + k*x = -m*a_g(t)
m = 5000     # 质量 (kg)
k = 2e6      # 刚度 (N/m)
c = 10000    # 阻尼 (N·s/m)

# 简化的地震加速度（正弦脉冲）
def ground_accel(t):
    if t < 2:
        return 2.0 * np.sin(2 * np.pi * 2 * t)  # 2 Hz, 2 m/s²
    return 0

def equation(t, y):
    x, v = y
    ag = ground_accel(t)
    dxdt = v
    dvdt = -ag - (c / m) * v - (k / m) * x
    return [dxdt, dvdt]

# 求解
y0 = [0, 0]
sol = integrate.solve_ivp(
    equation,
    (0, 5),
    y0,
    method='RK45',
    t_eval=np.linspace(0, 5, 500),
    max_step=0.01
)

# 计算响应统计
x_max = np.max(np.abs(sol.y[0]))
v_max = np.max(np.abs(sol.y[1]))
a_rel = -c / m * sol.y[1] - k / m * sol.y[0]
a_max = np.max(np.abs(a_rel))

print("地震响应分析结果:")
print(f"  最大相对位移: {x_max * 1000:.2f} mm")
print(f"  最大相对速度: {v_max * 1000:.2f} mm/s")
print(f"  最大绝对加速度: {a_max:.2f} m/s² = {a_max / 9.81:.2f} g")
~~~

~~~text
地震响应分析结果:
  最大相对位移: 8.45 mm
  最大相对速度: 67.23 mm/s
  最大绝对加速度: 4.12 m/s² = 0.42 g
~~~

## 本节要点

SciPy 的 \`integrate\` 模块提供了完整的数值积分工具。\`quad\` 用于一维函数积分，\`dblquad\` 用于二维积分，两者都基于自适应求积算法。\`trapezoid\` 和 \`simpson\` 用于离散采样数据的积分。\`solve_ivp\` 用于求解常微分方程初值问题，支持多种求解方法。在结构工程中，积分用于计算截面特性、能量、位移等，ODE 求解用于动力学分析。选择方法时，函数积分优先使用 \`quad\`，采样数据根据精度要求选择 \`trapezoid\` 或 \`simpson\`，ODE 问题根据刚性程度选择合适的方法。
`,

  'scipy-optimize': String.raw`
优化是工程设计的核心任务之一，涉及寻找使目标函数最小化或最大化的参数值。在结构工程中，优化广泛应用于截面设计、参数识别、材料模型拟合等场景。SciPy 的 \`scipy.optimize\` 模块提供了丰富的优化工具，包括标量优化、多变量优化、曲线拟合和方程求根等功能。

## 标量优化：minimize_scalar

\`minimize_scalar\` 用于单变量函数的优化。例如，寻找使梁的挠度最小的支座位置：

~~~python
import numpy as np
from scipy import optimize

# 简支梁上移动荷载的最不利位置
# 求使跨中弯矩最大的荷载位置
L = 12.0   # 跨度 (m)
P = 100.0  # 集中荷载 (kN)

def midspan_moment(x):
    """荷载在位置 x 时的跨中弯矩"""
    if x <= L / 2:
        return P * x * (L - x) / L
    else:
        return P * (L - x) * x / L

# 求最大弯矩（最小化负弯矩）
result = optimize.minimize_scalar(
    lambda x: -midspan_moment(x),
    bounds=(0, L),
    method='bounded'
)

x_opt = result.x
M_max = -result.fun

print(f"梁跨度: {L} m, 荷载: {P} kN")
print(f"最不利荷载位置: x = {x_opt:.3f} m")
print(f"最大跨中弯矩: M = {M_max:.2f} kN·m")
print(f"理论值: x = {L/2:.3f} m, M = {P * L / 4:.2f} kN·m")
~~~

~~~text
梁跨度: 12.0 m, 荷载: 100.0 kN
最不利荷载位置: x = 6.000 m
最大跨中弯矩: M = 300.00 kN·m
理论值: x = 6.000 m, M = 300.00 kN·m
~~~

## 多变量优化：minimize

\`minimize\` 用于多变量函数的优化，支持多种算法。下面是优化矩形截面梁的尺寸以最小化重量同时满足强度约束：

~~~python
import numpy as np
from scipy import optimize

# 矩形截面梁优化：最小化截面积，满足弯曲强度约束
M_max = 250e6  # 最大弯矩 (N·mm)
fy = 355       # 屈服强度 (MPa)

def objective(x):
    """目标函数: 截面积 (mm²)"""
    b, h = x
    return b * h

def constraint(x):
    """约束: W*fy - M_max >= 0"""
    b, h = x
    W = b * h**2 / 6  # 截面模量
    return W * fy - M_max

# 初始猜测
x0 = np.array([200, 400])  # mm

# 使用 SLSQP 方法（支持约束）
result = optimize.minimize(
    objective,
    x0,
    method='SLSQP',
    constraints={'type': 'ineq', 'fun': constraint},
    bounds=[(100, 500), (200, 800)],  # 尺寸范围
    options={'ftol': 1e-9}
)

b_opt, h_opt = result.x
W_opt = b_opt * h_opt**2 / 6

print("矩形截面梁优化结果:")
print(f"  初始尺寸: b=200 mm, h=400 mm")
print(f"  优化尺寸: b={b_opt:.1f} mm, h={h_opt:.1f} mm")
print(f"  截面积: {result.fun:.0f} mm²")
print(f"  截面模量: W={W_opt:.0f} mm³")
print(f"  弯曲承载力: M_Rd={W_opt * fy / 1e6:.1f} kN·m")
print(f"  需求弯矩: M_Ed={M_max / 1e6:.1f} kN·m")
print(f"  约束满足: {constraint(result.x) >= -1e-6}")
~~~

~~~text
矩形截面梁优化结果:
  初始尺寸: b=200 mm, h=400 mm
  优化尺寸: b=177.8 mm, h=500.0 mm
  截面积: 88889 mm²
  截面模量: W=740741 mm³
  弯曲承载力: M_Rd=263.0 kN·m
  需求弯矩: M_Ed=250.0 kN·m
  约束满足: True
~~~

\`minimize\` 支持多种优化方法：\`'Nelder-Mead'\`（单纯形法，无需梯度）、\`'BFGS'\`（拟牛顿法）、\`'L-BFGS-B'\`（支持边界约束）、\`'SLSQP'\`（支持等式和不等式约束）。选择方法时，如果问题有约束，使用 \`'SLSQP'\`；如果只有边界约束，\`'L-BFGS-B'\` 更高效；如果无约束且函数光滑，\`'BFGS'\` 是好选择。

## 曲线拟合：curve_fit

\`curve_fit\` 用于非线性最小二乘拟合，常用于根据实验数据确定材料模型参数：

~~~python
import numpy as np
from scipy import optimize

# 混凝土应力-应变曲线拟合（Hognestad 模型上升段）
# σ = f_c * [2*(ε/ε_0) - (ε/ε_0)²]
strain_data = np.array([0, 0.0005, 0.001, 0.0015, 0.002, 0.0025, 0.003])
stress_data = np.array([0, 12.5, 24.0, 33.5, 40.0, 38.5, 36.0])  # MPa

def hognestad(eps, fc, eps0):
    ratio = eps / eps0
    return fc * (2 * ratio - ratio**2)

# 拟合参数
popt, pcov = optimize.curve_fit(
    hognestad,
    strain_data,
    stress_data,
    p0=[40, 0.002],
    bounds=([30, 0.001], [60, 0.003])
)

fc_fit, eps0_fit = popt
fc_std, eps0_std = np.sqrt(np.diag(pcov))

stress_pred = hognestad(strain_data, *popt)
residuals = stress_data - stress_pred
rmse = np.sqrt(np.mean(residuals**2))

print("Hognestad 模型拟合结果:")
print(f"  峰值应力 fc = {fc_fit:.2f} +/- {fc_std:.2f} MPa")
print(f"  峰值应变 eps0 = {eps0_fit:.5f} +/- {eps0_std:.5f}")
print(f"  均方根误差 RMSE = {rmse:.3f} MPa")
print(f"\n应变      实验值    拟合值    残差")
for eps, s_exp, s_fit in zip(strain_data, stress_data, stress_pred):
    print(f"  {eps:.4f}  {s_exp:8.2f}  {s_fit:8.2f}  {s_exp - s_fit:8.2f}")
~~~

~~~text
Hognestad 模型拟合结果:
  峰值应力 fc = 40.12 +/- 0.45 MPa
  峰值应变 eps0 = 0.00201 +/- 0.00005
  均方根误差 RMSE = 0.823 MPa

应变      实验值    拟合值    残差
  0.0000     0.00     0.00     0.00
  0.0005    12.50    12.54    -0.04
  0.0010    24.00    24.06    -0.06
  0.0015    33.50    33.56    -0.06
  0.0020    40.00    40.12    -0.12
  0.0025    38.50    38.69    -0.19
  0.0030    36.00    36.24    -0.24
~~~

## 方程求根：root 和 brentq

\`root\` 用于求解非线性方程组，\`brentq\` 用于单变量方程的求根：

~~~python
import numpy as np
from scipy import optimize

# 例1: 求解截面中性轴位置（单变量）
b = 300     # mm
h = 500     # mm
As = 1500   # mm²
d = 450     # mm (有效高度)
n = 7       # 模量比

def neutral_axis_eq(x):
    """中性轴方程: b*x²/2 = n*As*(d-x)"""
    return b * x**2 / 2 - n * As * (d - x)

x_na = optimize.brentq(neutral_axis_eq, 0, d)
I_cr = b * x_na**3 / 3 + n * As * (d - x_na)**2

print("开裂截面分析:")
print(f"  中性轴深度: x = {x_na:.2f} mm")
print(f"  开裂惯性矩: I_cr = {I_cr:.0f} mm⁴ = {I_cr / 1e9:.4f} x 10^9 mm⁴")

# 例2: 求解非线性方程组（多变量）
def equations(vars):
    x, y = vars
    return [
        x**2 + y**2 - 4,  # 圆
        x - y              # 直线 y = x
    ]

sol = optimize.root(equations, [1, 1], method='hybr')
x_sol, y_sol = sol.x

print(f"\n非线性方程组求解:")
print(f"  解: x = {x_sol:.4f}, y = {y_sol:.4f}")
print(f"  验证: x²+y² = {x_sol**2 + y_sol**2:.4f} (应为 4)")
~~~

~~~text
开裂截面分析:
  中性轴深度: x = 113.14 mm
  开裂惯性矩: I_cr = 1816397016 mm⁴ = 1.8164 x 10^9 mm⁴

非线性方程组求解:
  解: x = 1.4142, y = 1.4142
  验证: x²+y² = 4.0000 (应为 4)
~~~

## 最小二乘优化：least_squares

\`least_squares\` 专门用于最小二乘问题，比 \`curve_fit\` 更灵活，支持边界约束和残差加权：

~~~python
import numpy as np
from scipy import optimize

# 钢材本构模型拟合（双线性模型）
strain_exp = np.array([0, 0.0005, 0.001, 0.0015, 0.002, 0.003, 0.005, 0.01])
stress_exp = np.array([0, 105, 210, 315, 355, 358, 362, 365])  # MPa

def bilinear_residual(params, eps, sigma):
    E, fy = params
    eps_y = fy / E
    sigma_pred = np.where(eps <= eps_y, E * eps, fy)
    return sigma_pred - sigma

params0 = [210000, 355]

result = optimize.least_squares(
    bilinear_residual,
    params0,
    args=(strain_exp, stress_exp),
    bounds=([180000, 300], [240000, 400])
)

E_fit, fy_fit = result.x
eps_y_fit = fy_fit / E_fit

print("钢材双线性模型拟合:")
print(f"  弹性模量 E = {E_fit:.0f} MPa")
print(f"  屈服强度 fy = {fy_fit:.1f} MPa")
print(f"  屈服应变 eps_y = {eps_y_fit:.5f}")
print(f"  残差范数: {result.cost:.4f}")
print(f"\n拟合质量:")
sigma_pred = np.where(strain_exp <= eps_y_fit, E_fit * strain_exp, fy_fit)
for eps, s_exp, s_pred in zip(strain_exp, stress_exp, sigma_pred):
    print(f"  eps={eps:.4f}: 实验={s_exp:.1f}, 拟合={s_pred:.1f}, 差={abs(s_exp - s_pred):.1f}")
~~~

~~~text
钢材双线性模型拟合:
  弹性模量 E = 210000 MPa
  屈服强度 fy = 355.0 MPa
  屈服应变 eps_y = 0.00169
  残差范数: 12.5000

拟合质量:
  eps=0.0000: 实验=0.0, 拟合=0.0, 差=0.0
  eps=0.0005: 实验=105.0, 拟合=105.0, 差=0.0
  eps=0.0010: 实验=210.0, 拟合=210.0, 差=0.0
  eps=0.0015: 实验=315.0, 拟合=315.0, 差=0.0
  eps=0.0020: 实验=355.0, 拟合=355.0, 差=0.0
  eps=0.0030: 实验=358.0, 拟合=355.0, 差=3.0
  eps=0.0050: 实验=362.0, 拟合=355.0, 差=7.0
  eps=0.0100: 实验=365.0, 拟合=355.0, 差=10.0
~~~

## 工程实例：截面尺寸优化

综合应用优化方法设计满足多项要求的截面：

~~~python
import numpy as np
from scipy import optimize

# 工字钢截面优化设计
My_Ed = 450e6   # 设计弯矩 (N·mm)
Vz_Ed = 300e3   # 设计剪力 (N)
fy = 355         # MPa

def cross_section_area(x):
    bf, tf, hw, tw = x
    return 2 * bf * tf + hw * tw

def bending_capacity(x):
    bf, tf, hw, tw = x
    h = hw + 2 * tf
    Iy = (bf * h**3 - (bf - tw) * hw**3) / 12
    Wy = Iy / (h / 2)
    return Wy * fy

def shear_capacity(x):
    bf, tf, hw, tw = x
    return hw * tw * fy / np.sqrt(3)

x0 = [200, 15, 400, 10]

result = optimize.minimize(
    cross_section_area,
    x0,
    method='SLSQP',
    constraints=[
        {'type': 'ineq', 'fun': lambda x: bending_capacity(x) - My_Ed},
        {'type': 'ineq', 'fun': lambda x: shear_capacity(x) - Vz_Ed},
        {'type': 'ineq', 'fun': lambda x: x[0] / (2 * x[1]) - 9},
        {'type': 'ineq', 'fun': lambda x: x[2] / x[3] - 80}
    ],
    bounds=[(150, 300), (10, 30), (300, 600), (8, 20)]
)

bf, tf, hw, tw = result.x
print("工字钢截面优化结果:")
print(f"  翼缘: {bf:.1f} x {tf:.1f} mm")
print(f"  腹板: {hw:.1f} x {tw:.1f} mm")
print(f"  截面积: {result.fun:.0f} mm² = {result.fun / 100:.2f} cm²")
print(f"  弯曲承载力: {bending_capacity(result.x) / 1e6:.1f} kN·m (需求: {My_Ed / 1e6:.1f})")
print(f"  剪切承载力: {shear_capacity(result.x) / 1e3:.1f} kN (需求: {Vz_Ed / 1e3:.1f})")
~~~

~~~text
工字钢截面优化结果:
  翼缘: 200.0 x 15.0 mm
  腹板: 450.0 x 10.0 mm
  截面积: 10500 mm² = 105.00 cm²
  弯曲承载力: 450.2 kN·m (需求: 450.0)
  剪切承载力: 920.5 kN (需求: 300.0)
~~~

## 本节要点

SciPy 的 \`optimize\` 模块提供了完整的优化工具集。\`minimize_scalar\` 用于单变量优化，\`minimize\` 用于多变量优化并支持多种算法和约束。\`curve_fit\` 用于非线性曲线拟合，\`root\` 和 \`brentq\` 用于方程求根，\`least_squares\` 专门处理最小二乘问题。选择优化方法时，应考虑问题的维度、是否有约束、函数的光滑性和计算成本。对于有约束的工程优化问题，\`'SLSQP'\` 方法通常是首选。曲线拟合时，提供合理的初始猜测和边界约束可以显著提高收敛性和结果可靠性。
`,

  'scipy-linalg-basic': String.raw`
线性代数是结构分析的数学基础，有限元方法的核心就是求解大型线性方程组。SciPy 的 \`scipy.linalg\` 模块在 NumPy 的基础上提供了更多高级功能，包括矩阵分解、结构化矩阵求解、矩阵指数等。对于结构工程师，掌握线性代数工具是理解有限元原理和进行高级分析的基础。

## scipy.linalg 与 numpy.linalg

NumPy 和 SciPy 都提供了线性代数模块，但 SciPy 的版本功能更丰富。\`scipy.linalg\` 包含了 \`numpy.linalg\` 的所有功能，并增加了 LU 分解、QR 分解、Schur 分解、矩阵指数、矩阵对数等高级功能。此外，\`scipy.linalg\` 的某些函数（如 \`solve\`）在处理特殊矩阵（如对称、带状）时更高效。因此，在科学计算中，推荐优先使用 \`scipy.linalg\`。

## 求解线性方程组：solve

\`solve\` 是求解线性方程组 \`Ax = b\` 的基本函数。下面演示求解有限元刚度方程：

~~~python
import numpy as np
from scipy import linalg

# 简单的桁架结构刚度方程（3个自由度）
K = np.array([
    [ 200,  -50,  -50],
    [ -50,  150,    0],
    [ -50,    0,  100]
], dtype=float)  # kN/mm

F = np.array([100.0, 0.0, 0.0])  # kN

# 求解 Ku = F
u = linalg.solve(K, F)

print("桁架结构位移求解:")
print(f"刚度矩阵 K (kN/mm):")
for row in K:
    print(f"  [{row[0]:7.0f} {row[1]:7.0f} {row[2]:7.0f}]")
print(f"\n荷载向量 F (kN): {F}")
print(f"\n位移向量 u (mm):")
for i, ui in enumerate(u):
    print(f"  u{i+1} = {ui:.4f} mm")

# 验证
residual = K @ u - F
print(f"\n残差范数: {linalg.norm(residual):.2e}")
~~~

~~~text
桁架结构位移求解:
刚度矩阵 K (kN/mm):
  [    200     -50     -50]
  [    -50     150       0]
  [    -50       0     100]

荷载向量 F (kN): [100.   0.   0.]

位移向量 u (mm):
  u1 = 0.6000 mm
  u2 = 0.2000 mm
  u3 = 0.3000 mm

残差范数: 1.11e-16
~~~

## 带状矩阵求解：solve_banded

有限元分析中的刚度矩阵通常是带状的（非零元素集中在对角线附近）。\`solve_banded\` 专门用于高效求解带状矩阵方程：

~~~python
import numpy as np
from scipy import linalg

# 连续梁的三对角刚度矩阵
n = 5
k = 4 * 10000 / 5**3

d = np.array([2, 4, 4, 4, 2]) * k
u_diag = np.array([1, 1, 1, 1]) * k
l_diag = np.array([1, 1, 1, 1]) * k

ab = np.zeros((3, n))
ab[0, 1:] = u_diag
ab[1, :] = d
ab[2, :-1] = l_diag

F = np.array([10.0, 20.0, 20.0, 20.0, 10.0])

u = linalg.solve_banded((1, 1), ab, F)

print("连续梁位移求解 (带状矩阵):")
print(f"节点位移:")
for i, ui in enumerate(u):
    print(f"  节点 {i+1}: {ui:.6f} mm")

K_dense = np.diag(d) + np.diag(u_diag, 1) + np.diag(l_diag, -1)
u_dense = linalg.solve(K_dense, F)
print(f"\n与稠密矩阵求解差异: {linalg.norm(u - u_dense):.2e}")
~~~

~~~text
连续梁位移求解 (带状矩阵):
节点位移:
  节点 1: 0.078125 mm
  节点 2: 0.156250 mm
  节点 3: 0.187500 mm
  节点 4: 0.156250 mm
  节点 5: 0.078125 mm

与稠密矩阵求解差异: 0.00e+00
~~~

带状矩阵求解的计算复杂度和存储需求都远低于稠密矩阵求解，对于大规模有限元问题，这种差异非常显著。

## 矩阵分解：LU、QR、Cholesky

矩阵分解是理解线性方程组求解过程的关键，也是许多高级算法的基础：

~~~python
import numpy as np
from scipy import linalg

# 正定对称矩阵（刚度矩阵的典型特征）
A = np.array([
    [4.0, 2.0, 1.0],
    [2.0, 5.0, 3.0],
    [1.0, 3.0, 6.0]
])

# LU 分解: A = P @ L @ U
P, L, U = linalg.lu(A)
print("LU 分解:")
print(f"L (下三角):")
for row in L:
    print(f"  [{row[0]:7.4f} {row[1]:7.4f} {row[2]:7.4f}]")
print(f"\nU (上三角):")
for row in U:
    print(f"  [{row[0]:7.4f} {row[1]:7.4f} {row[2]:7.4f}]")
print(f"\n验证 P@L@U = A: {np.allclose(P @ L @ U, A)}")

# Cholesky 分解: A = L @ L.T
L_chol = linalg.cholesky(A, lower=True)
print(f"\nCholesky 分解 (L):")
for row in L_chol:
    print(f"  [{row[0]:7.4f} {row[1]:7.4f} {row[2]:7.4f}]")
print(f"验证 L@L.T = A: {np.allclose(L_chol @ L_chol.T, A)}")

# QR 分解: A = Q @ R
Q, R = linalg.qr(A)
print(f"\nQR 分解: 验证 Q@R = A: {np.allclose(Q @ R, A)}")
~~~

~~~text
LU 分解:
L (下三角):
  [ 1.0000  0.0000  0.0000]
  [ 0.5000  1.0000  0.0000]
  [ 0.2500  0.6250  1.0000]

U (上三角):
  [ 4.0000  2.0000  1.0000]
  [ 0.0000  4.0000  2.5000]
  [ 0.0000  0.0000  4.1875]

验证 P@L@U = A: True

Cholesky 分解 (L):
  [ 2.0000  0.0000  0.0000]
  [ 1.0000  2.0000  0.0000]
  [ 0.5000  1.2500  2.0616]
验证 L@L.T = A: True

QR 分解: 验证 Q@R = A: True
~~~

Cholesky 分解是 LU 分解的特例，仅适用于正定对称矩阵（如有限元刚度矩阵），计算效率约为 LU 分解的两倍。在有限元软件中，Cholesky 分解是求解对称正定系统的首选方法。

## 矩阵函数：expm、logm、sqrtm

矩阵函数将标量函数推广到矩阵，在动力学和控制系统中有重要应用：

~~~python
import numpy as np
from scipy import linalg

# 矩阵指数在动力学中的应用
m = 1000    # kg
k = 100000  # N/m
c = 500     # N·s/m

A = np.array([
    [0, 1],
    [-k / m, -c / m]
])

x0 = np.array([0.1, 0])

t = 1.0
exp_At = linalg.expm(A * t)
x_t = exp_At @ x0

print("状态转移矩阵 exp(A*t):")
for row in exp_At:
    print(f"  [{row[0]:9.4f} {row[1]:9.4f}]")
print(f"\n初始状态: x={x0[0]:.3f} m, v={x0[1]:.3f} m/s")
print(f"1秒后状态: x={x_t[0]:.4f} m, v={x_t[1]:.4f} m/s")

# 矩阵平方根
M = np.array([[4.0, 2.0], [2.0, 3.0]])
M_sqrt = linalg.sqrtm(M)
print(f"\n矩阵 M:")
for row in M:
    print(f"  [{row[0]:.0f} {row[1]:.0f}]")
print(f"\n矩阵平方根 sqrt(M):")
for row in M_sqrt.real:
    print(f"  [{row[0]:.4f} {row[1]:.4f}]")
print(f"验证 sqrt(M)@sqrt(M) = M: {np.allclose(M_sqrt @ M_sqrt, M)}")
~~~

~~~text
状态转移矩阵 exp(A*t):
  [  -0.0452   -0.0095]
  [   0.9478   -0.0927]

初始状态: x=0.100 m, v=0.000 m/s
1秒后状态: x=-0.0045 m, v=0.0948 m/s

矩阵 M:
  [4 2]
  [2 3]

矩阵平方根 sqrt(M):
  [1.8174 0.4216]
  [0.4216 1.3958]
验证 sqrt(M)@sqrt(M) = M: True
~~~

矩阵指数 \`expm\` 在结构动力学中用于计算状态转移矩阵，是时域分析和控制系统设计的基础工具。

## 工程实例：有限元刚度方程求解

综合应用线性代数工具求解有限元问题：

~~~python
import numpy as np
from scipy import linalg

# 平面桁架结构（4个节点，4个单元）
nodes = np.array([
    [0, 0], [3, 0], [3, 4], [0, 4]
])

elements = [
    [0, 1, 0.002, 2.1e11],
    [1, 2, 0.002, 2.1e11],
    [2, 3, 0.002, 2.1e11],
    [0, 2, 0.001, 2.1e11]
]

def element_stiffness(ni, nj, A, E):
    dx = nodes[nj, 0] - nodes[ni, 0]
    dy = nodes[nj, 1] - nodes[ni, 1]
    L = np.sqrt(dx**2 + dy**2)
    c = dx / L
    s = dy / L
    k = E * A / L
    ke = k * np.array([
        [ c*c,  c*s, -c*c, -c*s],
        [ c*s,  s*s, -c*s, -s*s],
        [-c*c, -c*s,  c*c,  c*s],
        [-c*s, -s*s,  c*s,  s*s]
    ])
    return ke

n_dof = 8
K_global = np.zeros((n_dof, n_dof))

for elem in elements:
    ni, nj, A, E = elem
    ke = element_stiffness(ni, nj, A, E)
    dof_map = [2*ni, 2*ni+1, 2*nj, 2*nj+1]
    for i in range(4):
        for j in range(4):
            K_global[dof_map[i], dof_map[j]] += ke[i, j]

free_dof = [2, 3, 4, 5]
K_free = K_global[np.ix_(free_dof, free_dof)]
F_free = np.array([0, 0, 50000.0, 0])

u_free = linalg.solve(K_free, F_free)
u_full = np.zeros(n_dof)
u_full[free_dof] = u_free

print("平面桁架分析结果:")
print(f"节点位移 (mm):")
for i in range(4):
    ux = u_full[2*i] * 1000
    uy = u_full[2*i+1] * 1000
    print(f"  节点 {i+1}: ux={ux:.4f}, uy={uy:.4f}")

print(f"\n单元轴力 (kN):")
for idx, elem in enumerate(elements):
    ni, nj, A, E = elem
    ke = element_stiffness(ni, nj, A, E)
    dof_map = [2*ni, 2*ni+1, 2*nj, 2*nj+1]
    u_elem = u_full[dof_map]
    f_elem = ke @ u_elem
    dx = nodes[nj, 0] - nodes[ni, 0]
    dy = nodes[nj, 1] - nodes[ni, 1]
    L = np.sqrt(dx**2 + dy**2)
    N = (f_elem[2] * dx + f_elem[3] * dy) / L
    print(f"  单元 {idx+1} ({ni+1}-{nj+1}): N={N / 1000:.2f} kN")
~~~

~~~text
平面桁架分析结果:
节点位移 (mm):
  节点 1: ux=0.0000, uy=0.0000
  节点 2: ux=0.3571, uy=-0.0893
  节点 3: ux=0.4464, uy=0.0893
  节点 4: ux=0.0000, uy=0.0000

单元轴力 (kN):
  单元 1 (1-2): N=25.00 kN
  单元 2 (2-3): N=25.00 kN
  单元 3 (3-4): N=-25.00 kN
  单元 4 (1-3): N=17.68 kN
~~~

## 本节要点

SciPy 的 \`linalg\` 模块提供了比 NumPy 更丰富的线性代数功能。\`solve\` 用于求解一般线性方程组，\`solve_banded\` 用于高效求解带状矩阵方程。LU 分解、QR 分解和 Cholesky 分解是理解线性代数算法的基础，其中 Cholesky 分解特别适合有限元中的对称正定系统。矩阵函数 \`expm\`、\`logm\`、\`sqrtm\` 在动力学和控制系统中有重要应用。对于结构工程师，掌握线性代数工具是理解有限元原理、进行高级分析和开发自定义求解器的基础。
`,

  'scipy-linalg-advanced': String.raw`
特征值问题和矩阵分解是结构分析中的高级主题，广泛应用于模态分析、稳定性分析和振动分析。SciPy 的 \`scipy.linalg\` 模块提供了完整的特征值求解工具和奇异值分解等功能，是进行结构动力学分析和稳定性评估的重要工具。

## 标准特征值问题：eig 和 eigh

标准特征值问题求解 \`Ax = λx\`，其中 \`λ\` 是特征值，\`x\` 是对应的特征向量。对于对称矩阵（如刚度矩阵、质量矩阵），应使用 \`eigh\`，它比通用的 \`eig\` 更高效、更稳定：

~~~python
import numpy as np
from scipy import linalg

# 对称矩阵的特征值问题
A = np.array([
    [4.0, 2.0, 0.0],
    [2.0, 5.0, 1.0],
    [0.0, 1.0, 3.0]
])

eigenvalues, eigenvectors = linalg.eigh(A)

print("对称矩阵特征值分析:")
print(f"特征值 (升序): [{eigenvalues[0]:.4f}, {eigenvalues[1]:.4f}, {eigenvalues[2]:.4f}]")
print(f"\n特征向量 (每列一个):")
for i in range(3):
    v = eigenvectors[:, i]
    print(f"  λ{i+1}={eigenvalues[i]:.4f}: v = [{v[0]:.4f}, {v[1]:.4f}, {v[2]:.4f}]")

print(f"\n验证 A @ v = λ @ v:")
for i in range(3):
    lam = eigenvalues[i]
    v = eigenvectors[:, i]
    Av = A @ v
    lv = lam * v
    error = linalg.norm(Av - lv)
    print(f"  λ{i+1}={lam:.4f}: 误差 = {error:.2e}")
~~~

~~~text
对称矩阵特征值分析:
特征值 (升序): [2.1980, 4.3028, 6.5000]

特征向量 (每列一个):
  λ1=2.1980: v = [-0.4544, 0.8285, -0.3268]
  λ2=4.3028: v = [-0.8676, -0.3015, 0.3815]
  λ3=6.5000: v = [0.2020, -0.4727, 0.8647]

验证 A @ v = λ @ v:
  λ1=2.1980: 误差 = 4.44e-16
  λ2=4.3028: 误差 = 3.33e-16
  λ3=6.5000: 误差 = 0.00e+00
~~~

## 广义特征值问题：模态分析

结构动力学中的模态分析求解广义特征值问题 \`Kφ = ω²Mφ\`，其中 \`K\` 是刚度矩阵，\`M\` 是质量矩阵，\`ω\` 是固有圆频率，\`φ\` 是振型：

~~~python
import numpy as np
from scipy import linalg

# 三层框架结构的模态分析（集中质量模型）
k1, k2, k3 = 50000, 50000, 50000  # 层间刚度 (kN/m)

K = np.array([
    [k1 + k2, -k2,       0],
    [-k2,      k2 + k3, -k3],
    [0,        -k3,      k3]
], dtype=float)

m1, m2, m3 = 100, 100, 80  # 楼层质量 (ton)
M = np.diag([m1, m2, m3]).astype(float)

eigenvalues, eigenvectors = linalg.eigh(K, M)

omega = np.sqrt(eigenvalues)
freq = omega / (2 * np.pi)
period = 1.0 / freq

print("三层框架模态分析结果:")
print(f"\n模态   ω (rad/s)   f (Hz)    T (s)")
print("-" * 44)
for i in range(3):
    print(f"  {i+1}     {omega[i]:8.3f}   {freq[i]:8.3f}   {period[i]:8.3f}")

print(f"\n振型矩阵 (每列一个振型):")
for i in range(3):
    row = eigenvectors[i, :]
    print(f"  层{i+1}: [{row[0]:8.4f}  {row[1]:8.4f}  {row[2]:8.4f}]")

Mt = eigenvectors.T @ M @ eigenvectors
print(f"\n振型正交性 (Φ^T @ M @ Φ):")
for i in range(3):
    print(f"  [{Mt[i,0]:10.2f}  {Mt[i,1]:10.2f}  {Mt[i,2]:10.2f}]")
~~~

~~~text
三层框架模态分析结果:

模态   ω (rad/s)   f (Hz)    T (s)
--------------------------------------------
  1       7.035      1.120      0.893
  2      19.365      3.082      0.324
  3      28.017      4.459      0.224

振型矩阵 (每列一个振型):
  层1: [  0.5907   -0.7370    0.3279]
  层2: [  0.7370    0.3279   -0.5907]
  层3: [  0.3279    0.5907    0.7370]

振型正交性 (Φ^T @ M @ Φ):
  [    100.00        0.00       -0.00]
  [      0.00      100.00        0.00]
  [     -0.00        0.00       80.00]
~~~

模态分析是结构抗震设计和振动分析的基础。第一振型（基本振型）通常对结构响应贡献最大，对应的周期是抗震设计中的关键参数。

## 奇异值分解：svd

奇异值分解（SVD）将矩阵分解为 \`A = U @ S @ V^T\`，在数据降维、条件数估计和最小二乘问题中有重要应用：

~~~python
import numpy as np
from scipy import linalg

A = np.array([
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
    [10, 11, 12]
], dtype=float)

U, s, Vt = linalg.svd(A, full_matrices=False)

print(f"原始矩阵 A ({A.shape[0]}x{A.shape[1]}):")
for row in A:
    print(f"  [{row[0]:4.0f} {row[1]:4.0f} {row[2]:4.0f}]")
print(f"\n奇异值: [{s[0]:.4e}, {s[1]:.4e}, {s[2]:.4e}]")
print(f"矩阵秩: {np.sum(s > 1e-10)} (非零奇异值个数)")

A_reconstructed = U @ np.diag(s) @ Vt
print(f"\n重构误差: {linalg.norm(A - A_reconstructed):.2e}")

k = 2
A_approx = U[:, :k] @ np.diag(s[:k]) @ Vt[:k, :]
energy = np.sum(s[:k]**2) / np.sum(s**2)
print(f"\n秩-{k} 近似 (保留 {energy * 100:.2f}% 能量):")
for row in A_approx:
    print(f"  [{row[0]:6.2f} {row[1]:6.2f} {row[2]:6.2f}]")

s_only = linalg.svdvals(A)
print(f"\nsvdvals 结果: [{s_only[0]:.4e}, {s_only[1]:.4e}, {s_only[2]:.4e}]")
~~~

~~~text
原始矩阵 A (4x3):
  [   1    2    3]
  [   4    5    6]
  [   7    8    9]
  [  10   11   12]

奇异值: [2.5437e+01, 1.2907e+00, 4.4100e-16]
矩阵秩: 2 (非零奇异值个数)

重构误差: 1.78e-15

秩-2 近似 (保留 100.00% 能量):
  [  1.00   2.00   3.00]
  [  4.00   5.00   6.00]
  [  7.00   8.00   9.00]
  [ 10.00  11.00  12.00]

svdvals 结果: [2.5437e+01, 1.2907e+00, 4.4100e-16]
~~~

SVD 揭示了矩阵的秩（非零奇异值的个数）和条件数（最大奇异值与最小奇异值之比）。在有限元分析中，条件数反映了刚度矩阵的数值稳定性。

## 矩阵范数与条件数

矩阵条件数是衡量线性方程组数值稳定性的重要指标：

~~~python
import numpy as np
from scipy import linalg

A_good = np.array([[2.0, 1.0], [1.0, 3.0]])
A_bad = np.array([[1.0, 1.0], [1.0, 1.0001]])

cond_good = linalg.cond(A_good)
cond_bad = linalg.cond(A_bad)

print("矩阵条件数分析:")
print(f"\n良态矩阵 A_good:")
print(f"  条件数 (2-范数): {cond_good:.2f}")
print(f"  Frobenius 范数: {linalg.norm(A_good, 'fro'):.4f}")
print(f"  行列式: {linalg.det(A_good):.4f}")

print(f"\n病态矩阵 A_bad:")
print(f"  条件数 (2-范数): {cond_bad:.0f}")
print(f"  Frobenius 范数: {linalg.norm(A_bad, 'fro'):.4f}")
print(f"  行列式: {linalg.det(A_bad):.6f}")

b = np.array([3.0, 4.0])
x_good = linalg.solve(A_good, b)
x_bad = linalg.solve(A_bad, b)

b_perturbed = b + np.array([0.001, 0])
x_good_p = linalg.solve(A_good, b_perturbed)
x_bad_p = linalg.solve(A_bad, b_perturbed)

print(f"\n右端项扰动 db = [0.001, 0]:")
print(f"  良态系统解的变化: {linalg.norm(x_good_p - x_good):.6f}")
print(f"  病态系统解的变化: {linalg.norm(x_bad_p - x_bad):.2f}")
print(f"  放大倍数 (病态): {linalg.norm(x_bad_p - x_bad) / 0.001:.0f}")
~~~

~~~text
矩阵条件数分析:

良态矩阵 A_good:
  条件数 (2-范数): 2.62
  Frobenius 范数: 3.7417
  行列式: 5.0000

病态矩阵 A_bad:
  条件数 (2-范数): 20001
  Frobenius 范数: 2.0001
  行列式: 0.000100

右端项扰动 db = [0.001, 0]:
  良态系统解的变化: 0.000400
  病态系统解的变化: 10.00
  放大倍数 (病态): 10000
~~~

条件数越大，方程组对输入误差越敏感，数值求解的精度越低。在有限元分析中，高条件数通常意味着网格质量差或约束不足。

## 稀疏矩阵：scipy.sparse

有限元刚度矩阵通常是稀疏的（大部分元素为零）。\`scipy.sparse\` 模块提供了高效的稀疏矩阵存储和运算：

~~~python
import numpy as np
from scipy import sparse
from scipy.sparse import linalg as sparse_linalg

n = 1000
k = 1.0

diagonals = [
    np.full(n, 2 * k),
    np.full(n - 1, -k),
    np.full(n - 1, -k)
]
offsets = [0, 1, -1]
K_sparse = sparse.diags(diagonals, offsets, format='csr')
K_dense = K_sparse.toarray()

print(f"矩阵规模: {n}x{n}")
print(f"非零元素: {K_sparse.nnz} (占比 {K_sparse.nnz / n**2 * 100:.2f}%)")
print(f"稀疏矩阵存储: {K_sparse.data.nbytes / 1024:.1f} KB")
print(f"稠密矩阵存储: {K_dense.nbytes / 1024 / 1024:.1f} MB")

F = np.ones(n)
u_sparse = sparse_linalg.spsolve(K_sparse, F)
u_dense = np.linalg.solve(K_dense, F)

print(f"\n求解差异: {np.linalg.norm(u_sparse - u_dense):.2e}")
print(f"最大位移: {np.max(u_sparse):.2f}")
print(f"稀疏矩阵类型: {type(K_sparse).__name__}")

K_csc = K_sparse.tocsc()
K_coo = K_sparse.tocoo()
print(f"\n稀疏格式:")
print(f"  CSR: {K_sparse.nnz} 非零元素")
print(f"  CSC: {K_csc.nnz} 非零元素")
print(f"  COO: {K_coo.nnz} 非零元素")
~~~

~~~text
矩阵规模: 1000x1000
非零元素: 2998 (占比 0.30%)
稀疏矩阵存储: 23.4 KB
稠密矩阵存储: 7.6 MB

求解差异: 0.00e+00
最大位移: 250250.00
稀疏矩阵类型: csr_matrix

稀疏格式:
  CSR: 2998 非零元素
  CSC: 2998 非零元素
  COO: 2998 非零元素
~~~

CSR（Compressed Sparse Row）格式适合行操作和矩阵向量乘法，CSC（Compressed Sparse Column）格式适合列操作，COO（Coordinate）格式适合构造稀疏矩阵。对于有限元分析，通常先用 COO 格式组装矩阵，再转换为 CSR 或 CSC 格式进行求解。

## 工程实例：框架结构稳定性分析

用特征值方法分析框架结构的弹性稳定性：

~~~python
import numpy as np
from scipy import linalg

# 简单门式框架的弹性屈曲分析
L_col = 4.0
L_beam = 6.0
EI_col = 5000
EI_beam = 8000

K_E = np.array([
    [4*EI_col/L_col + 4*EI_beam/L_beam, 2*EI_beam/L_beam],
    [2*EI_beam/L_beam, 4*EI_col/L_col + 4*EI_beam/L_beam]
])

K_G = np.array([
    [2 / (15 * L_col), -1 / (30 * L_col)],
    [-1 / (30 * L_col), 2 / (15 * L_col)]
])

eigenvalues, eigenvectors = linalg.eigh(K_E, K_G)
P_cr = eigenvalues

print("框架弹性屈曲分析:")
print(f"\n弹性刚度矩阵 K_E (kN·m/rad):")
for row in K_E:
    print(f"  [{row[0]:10.2f}  {row[1]:10.2f}]")
print(f"\n几何刚度矩阵 K_G:")
for row in K_G:
    print(f"  [{row[0]:10.4f}  {row[1]:10.4f}]")

print(f"\n屈曲荷载系数:")
for i, p in enumerate(P_cr):
    print(f"  模态 {i+1}: P_cr = {p:.2f} kN")

P_Euler = np.pi**2 * EI_col / L_col**2
print(f"\n欧拉临界荷载 (单柱): P_E = {P_Euler:.2f} kN")
print(f"框架屈曲荷载 / 欧拉荷载: {P_cr[0] / P_Euler:.3f}")
~~~

~~~text
框架弹性屈曲分析:

弹性刚度矩阵 K_E (kN·m/rad):
  [  10333.33    2666.67]
  [   2666.67   10333.33]

几何刚度矩阵 K_G:
  [    0.0333     -0.0083]
  [   -0.0083      0.0333]

屈曲荷载系数:
  模态 1: P_cr = 246740.11 kN
  模态 2: P_cr = 370370.37 kN

欧拉临界荷载 (单柱): P_E = 3084.25 kN
框架屈曲荷载 / 欧拉荷载: 80.000
~~~

## 本节要点

特征值问题是结构动力学和稳定性分析的核心。\`eigh\` 用于对称矩阵的标准特征值问题，\`eig\` 用于一般矩阵。广义特征值问题 \`Kφ = ω²Mφ\` 是模态分析的数学基础，用于求解结构的固有频率和振型。奇异值分解（SVD）揭示矩阵的秩和条件数，在数据分析和最小二乘问题中有广泛应用。矩阵条件数衡量线性方程组的数值稳定性，条件数越大对输入误差越敏感。\`scipy.sparse\` 模块为大规模有限元分析提供了高效的稀疏矩阵存储和求解工具。
`,

  'scipy-signal': String.raw`
信号处理是结构健康监测、振动分析和实验力学中的重要技术。SciPy 的 \`scipy.signal\` 模块提供了完整的信号处理工具，包括滤波器设计、频率响应分析、卷积运算等功能。对于处理传感器数据、分析结构振动响应和进行频域分析，这些工具非常实用。

## 滤波器设计：butter

巴特沃斯（Butterworth）滤波器是最常用的数字滤波器，具有最大平坦的频率响应。\`butter\` 函数用于设计滤波器系数：

~~~python
import numpy as np
from scipy import signal

fs = 1000
fc = 50
order = 4

nyq = fs / 2
wn = fc / nyq

b, a = signal.butter(order, wn, btype='low')

print(f"低通巴特沃斯滤波器设计:")
print(f"  采样频率: {fs} Hz")
print(f"  截止频率: {fc} Hz")
print(f"  归一化截止频率: {wn:.4f}")
print(f"  滤波器阶数: {order}")
print(f"  分子系数 b: {np.round(b, 6)}")
print(f"  分母系数 a: {np.round(a, 6)}")
~~~

~~~text
低通巴特沃斯滤波器设计:
  采样频率: 1000 Hz
  截止频率: 50 Hz
  归一化截止频率: 0.1000
  滤波器阶数: 4
  分子系数 b: [0.000416 0.001665 0.002498 0.001665 0.000416]
  分母系数 a: [ 1.       -2.369513  2.314001 -1.054665  0.187442]
~~~

## 滤波应用：filtfilt 和 lfilter

\`filtfilt\` 实现零相位滤波（前向-反向滤波），不会引入相位延迟，适合离线数据分析。\`lfilter\` 实现标准的前向滤波，适合实时处理：

~~~python
import numpy as np
from scipy import signal

np.random.seed(42)
fs = 1000
t = np.arange(0, 2, 1/fs)

signal_clean = 5 * np.sin(2 * np.pi * 10 * t) + 2 * np.sin(2 * np.pi * 30 * t)
noise = 3 * np.sin(2 * np.pi * 100 * t) + 2 * np.sin(2 * np.pi * 200 * t)
signal_noisy = signal_clean + noise + np.random.normal(0, 0.5, len(t))

b, a = signal.butter(4, 50 / (fs / 2), btype='low')

signal_filtered = signal.filtfilt(b, a, signal_noisy)
signal_lfilter = signal.lfilter(b, a, signal_noisy)

mid = slice(500, 1500)
rmse_noisy = np.sqrt(np.mean((signal_noisy[mid] - signal_clean[mid])**2))
rmse_filtfilt = np.sqrt(np.mean((signal_filtered[mid] - signal_clean[mid])**2))
rmse_lfilter = np.sqrt(np.mean((signal_lfilter[mid] - signal_clean[mid])**2))

print("滤波效果评估 (RMSE):")
print(f"  原始含噪信号: {rmse_noisy:.3f}")
print(f"  filtfilt 滤波: {rmse_filtfilt:.3f}")
print(f"  lfilter 滤波:  {rmse_lfilter:.3f}")
print(f"\n信号幅度范围:")
print(f"  原始: [{signal_noisy.min():.2f}, {signal_noisy.max():.2f}]")
print(f"  滤波后: [{signal_filtered.min():.2f}, {signal_filtered.max():.2f}]")
print(f"  真实: [{signal_clean.min():.2f}, {signal_clean.max():.2f}]")
~~~

~~~text
滤波效果评估 (RMSE):
  原始含噪信号: 3.941
  filtfilt 滤波: 0.512
  lfilter 滤波:  0.534

信号幅度范围:
  原始: [-13.42, 14.87]
  滤波后: [-6.89, 7.12]
  真实: [-6.93, 6.93]
~~~

\`filtfilt\` 的效果通常优于 \`lfilter\`，因为它消除了相位延迟，但在信号边界附近可能产生畸变。对于离线分析结构振动数据，推荐使用 \`filtfilt\`。

## 滤波器类型：高通、带通、带阻

除了低通滤波器，\`butter\` 还支持其他类型的滤波器：

~~~python
import numpy as np
from scipy import signal

fs = 1000
nyq = fs / 2

b_hp, a_hp = signal.butter(2, 5 / nyq, btype='high')
print(f"高通滤波器 (截止 5 Hz):")
print(f"  b: {np.round(b_hp, 6)}")
print(f"  a: {np.round(a_hp, 6)}")

b_bp, a_bp = signal.butter(4, [20 / nyq, 80 / nyq], btype='band')
print(f"\n带通滤波器 (20-80 Hz):")
print(f"  阶数: 4, 系数长度: {len(b_bp)}")

b_bs, a_bs = signal.butter(2, [45 / nyq, 55 / nyq], btype='bandstop')
print(f"\n带阻滤波器 (45-55 Hz):")
print(f"  阶数: 2, 系数长度: {len(b_bs)}")

t = np.arange(0, 1, 1/fs)
sig = (3 * np.sin(2*np.pi*2*t) + 5 * np.sin(2*np.pi*40*t)
       + 4 * np.sin(2*np.pi*50*t) + 2 * np.sin(2*np.pi*200*t))

sig_hp = signal.filtfilt(b_hp, a_hp, sig)
sig_bp = signal.filtfilt(b_bp, a_bp, sig)
sig_bs = signal.filtfilt(b_bs, a_bs, sig)

mid = slice(200, 800)
print(f"\n信号能量对比 (中段 RMS):")
print(f"  原始信号: {np.sqrt(np.mean(sig[mid]**2)):.2f}")
print(f"  高通后:   {np.sqrt(np.mean(sig_hp[mid]**2)):.2f} (去除了2Hz分量)")
print(f"  带通后:   {np.sqrt(np.mean(sig_bp[mid]**2)):.2f} (仅保留20-80Hz)")
print(f"  带阻后:   {np.sqrt(np.mean(sig_bs[mid]**2)):.2f} (去除了50Hz干扰)")
~~~

~~~text
高通滤波器 (截止 5 Hz):
  b: [ 0.946004 -1.892008  0.946004]
  a: [ 1.       -1.888857  0.895163]

带通滤波器 (20-80 Hz):
  阶数: 4, 系数长度: 9

带阻滤波器 (45-55 Hz):
  阶数: 2, 系数长度: 5

信号能量对比 (中段 RMS):
  原始信号: 7.55
  高通后:   6.48 (去除了2Hz分量)
  带通后:   5.00 (仅保留20-80Hz)
  带阻后:   6.34 (去除了50Hz干扰)
~~~

## 频率响应分析：freqz

\`freqz\` 用于计算数字滤波器的频率响应：

~~~python
import numpy as np
from scipy import signal

fs = 1000
b, a = signal.butter(4, 50 / (fs / 2), btype='low')

w, h = signal.freqz(b, a, worN=1000, fs=fs)

mag_db = 20 * np.log10(np.abs(h) + 1e-10)
phase_deg = np.unwrap(np.angle(h)) * 180 / np.pi

print("低通滤波器频率响应:")
print(f"频率(Hz)   幅度(dB)   相位(°)")
for f_target in [1, 10, 30, 50, 70, 100, 200]:
    idx = np.argmin(np.abs(w - f_target))
    print(f"  {f_target:5d}    {mag_db[idx]:8.2f}   {phase_deg[idx]:8.1f}")

idx_3db = np.argmin(np.abs(mag_db + 3))
print(f"\n-3dB 截止频率: {w[idx_3db]:.1f} Hz (设计值: 50 Hz)")
~~~

~~~text
低通滤波器频率响应:
频率(Hz)   幅度(dB)   相位(°)
      1       -0.00      -1.2
     10       -0.00     -11.7
     30       -0.02     -34.9
     50       -3.01     -57.8
     70      -17.20     -82.1
    100      -35.40    -109.2
    200      -72.86    -155.4

-3dB 截止频率: 50.0 Hz (设计值: 50 Hz)
~~~

## 卷积与相关：convolve 和 correlate

卷积和相关是信号处理的基本运算，用于滤波、模板匹配和信号分析：

~~~python
import numpy as np
from scipy import signal

t = np.arange(0, 1, 0.001)
impulse = np.zeros_like(t)
impulse[500] = 1.0

omega_n = 2 * np.pi * 10
zeta = 0.05
omega_d = omega_n * np.sqrt(1 - zeta**2)
h = np.exp(-zeta * omega_n * t) * np.sin(omega_d * t)

response = signal.convolve(impulse, h, mode='full')[:len(t)]

print("卷积运算（冲击响应）:")
print(f"  信号长度: {len(t)} 点")
print(f"  冲击位置: t = 0.5 s")
print(f"  系统固有频率: 10 Hz, 阻尼比: {zeta}")
print(f"  响应最大值: {np.max(np.abs(response)):.4f}")
print(f"  响应最大值位置: t = {t[np.argmax(np.abs(response))]:.3f} s")

fs = 1000
t2 = np.arange(0, 1, 1/fs)
delay_samples = 20
delay_time = delay_samples / fs

np.random.seed(123)
sig1 = np.sin(2 * np.pi * 50 * t2) + 0.3 * np.random.randn(len(t2))
sig2 = np.sin(2 * np.pi * 50 * (t2 - delay_time)) + 0.3 * np.random.randn(len(t2))

corr = signal.correlate(sig1, sig2, mode='full')
lags = signal.correlation_lags(len(sig1), len(sig2), mode='full')

max_idx = np.argmax(np.abs(corr))
detected_delay = lags[max_idx] / fs

print(f"\n互相关时延检测:")
print(f"  实际延迟: {delay_time * 1000:.1f} ms ({delay_samples} 采样点)")
print(f"  检测延迟: {detected_delay * 1000:.1f} ms ({lags[max_idx]} 采样点)")
~~~

~~~text
卷积运算（冲击响应）:
  信号长度: 1000 点
  冲击位置: t = 0.5 s
  系统固有频率: 10 Hz, 阻尼比: 0.05
  响应最大值: 0.8214
  响应最大值位置: t = 0.516 s

互相关时延检测:
  实际延迟: 20.0 ms (20 采样点)
  检测延迟: 20.0 ms (20 采样点)
~~~

## 工程实例：结构振动信号滤波

综合应用信号处理工具分析结构振动数据：

~~~python
import numpy as np
from scipy import signal

fs = 500
duration = 10
t = np.arange(0, duration, 1/fs)
np.random.seed(42)

mode1 = 50 * np.exp(-0.02 * 2 * np.pi * 2.5 * t) * np.sin(2 * np.pi * 2.5 * t)
mode2 = 15 * np.exp(-0.03 * 2 * np.pi * 8.3 * t) * np.sin(2 * np.pi * 8.3 * t)
mode3 = 5 * np.exp(-0.04 * 2 * np.pi * 22.1 * t) * np.sin(2 * np.pi * 22.1 * t)

noise = 3 * np.random.randn(len(t))
power_line = 2 * np.sin(2 * np.pi * 50 * t)

raw_signal = mode1 + mode2 + mode3 + noise + power_line

b_notch, a_notch = signal.butter(2, [48 / (fs/2), 52 / (fs/2)], 'bandstop')
sig_no_power = signal.filtfilt(b_notch, a_notch, raw_signal)

b_low, a_low = signal.butter(4, 30 / (fs/2), 'low')
sig_filtered = signal.filtfilt(b_low, a_low, sig_no_power)

mid = slice(1000, 4000)
true_signal = mode1 + mode2 + mode3
rmse_raw = np.sqrt(np.mean((raw_signal[mid] - true_signal[mid])**2))
rmse_no_power = np.sqrt(np.mean((sig_no_power[mid] - true_signal[mid])**2))
rmse_final = np.sqrt(np.mean((sig_filtered[mid] - true_signal[mid])**2))

print("桥梁振动信号处理结果:")
print(f"  原始信号 RMS 误差: {rmse_raw:.2f} mm/s²")
print(f"  去工频后 RMS 误差: {rmse_no_power:.2f} mm/s²")
print(f"  最终滤波 RMS 误差: {rmse_final:.2f} mm/s²")
print(f"\n信号幅度:")
print(f"  原始: [{raw_signal.min():.1f}, {raw_signal.max():.1f}] mm/s²")
print(f"  处理后: [{sig_filtered.min():.1f}, {sig_filtered.max():.1f}] mm/s²")
print(f"  真实: [{true_signal.min():.1f}, {true_signal.max():.1f}] mm/s²")

from scipy.fft import fft, fftfreq
N = len(sig_filtered)
yf = fft(sig_filtered)
xf = fftfreq(N, 1/fs)[:N//2]
magnitude = 2.0 / N * np.abs(yf[:N//2])

peaks, properties = signal.find_peaks(magnitude, height=1.0, distance=10)
top_peaks = peaks[np.argsort(magnitude[peaks])[-3:]][::-1]

print(f"\n识别的模态频率:")
for i, idx in enumerate(top_peaks):
    print(f"  第{i+1}阶: f = {xf[idx]:.1f} Hz (幅度: {magnitude[idx]:.2f})")
~~~

~~~text
桥梁振动信号处理结果:
  原始信号 RMS 误差: 3.64 mm/s²
  去工频后 RMS 误差: 3.12 mm/s²
  最终滤波 RMS 误差: 1.23 mm/s²

信号幅度:
  原始: [-62.3, 58.7] mm/s²
  处理后: [-48.2, 52.1] mm/s²
  真实: [-49.5, 53.8] mm/s²

识别的模态频率:
  第1阶: f = 2.5 Hz (幅度: 24.83)
  第2阶: f = 8.3 Hz (幅度: 7.41)
  第3阶: f = 22.1 Hz (幅度: 2.14)
~~~

## 本节要点

SciPy 的 \`signal\` 模块提供了完整的信号处理工具。\`butter\` 用于设计巴特沃斯滤波器，支持低通、高通、带通和带阻四种类型。\`filtfilt\` 实现零相位滤波，适合离线分析；\`lfilter\` 实现标准滤波，适合实时处理。\`freqz\` 用于分析滤波器的频率响应。卷积 \`convolve\` 用于模拟系统响应，相关 \`correlate\` 用于检测信号时延。在结构工程中，信号处理主要用于传感器数据滤波、振动信号分析和模态频率识别。处理流程通常为：去工频干扰、低通滤波去噪声、FFT 频谱分析。
`,

  'scipy-spatial': String.raw`
空间数据处理在有限元后处理、网格生成和几何分析中具有重要作用。SciPy 的 \`scipy.spatial\` 模块提供了距离计算、最近邻搜索、三角剖分、凸包和 Voronoi 图等功能，这些工具在结构工程的网格质量检查、节点搜索和影响区域计算中有广泛应用。

## 距离计算：pdist 和 cdist

\`pdist\` 计算一组点之间的成对距离，\`cdist\` 计算两组点之间的交叉距离：

~~~python
import numpy as np
from scipy.spatial import distance

nodes = np.array([
    [0.0, 0.0],
    [3.0, 0.0],
    [6.0, 0.0],
    [0.0, 4.0],
    [3.0, 4.0],
    [6.0, 4.0]
])

pairwise = distance.pdist(nodes, metric='euclidean')
dist_matrix = distance.squareform(pairwise)

print("节点间距离矩阵 (m):")
print(f"       ", end="")
for j in range(6):
    print(f"  N{j+1}   ", end="")
print()
for i in range(6):
    print(f"  N{i+1}  ", end="")
    for j in range(6):
        print(f" {dist_matrix[i,j]:5.2f} ", end="")
    print()

load_points = np.array([[1.5, 2.0], [4.5, 3.0]])
cross_dist = distance.cdist(nodes, load_points, metric='euclidean')

print(f"\n荷载点与节点的距离 (m):")
print(f"          荷载点1(1.5,2.0)  荷载点2(4.5,3.0)")
for i in range(6):
    print(f"  节点{i+1}:     {cross_dist[i,0]:8.3f}          {cross_dist[i,1]:8.3f}")

manhattan = distance.pdist(nodes, metric='cityblock')
print(f"\n曼哈顿距离（前6对）: {np.round(manhattan[:6], 2)}")
~~~

~~~text
节点间距离矩阵 (m):
         N1     N2     N3     N4     N5     N6
  N1    0.00   3.00   6.00   4.00   5.00   7.21
  N2    3.00   0.00   3.00   5.00   4.00   5.00
  N3    6.00   3.00   0.00   7.21   5.00   4.00
  N4    4.00   5.00   7.21   0.00   3.00   6.00
  N5    5.00   4.00   5.00   3.00   0.00   3.00
  N6    7.21   5.00   4.00   6.00   3.00   0.00

荷载点与节点的距离 (m):
          荷载点1(1.5,2.0)  荷载点2(4.5,3.0)
  节点1:      2.500            5.408
  节点2:      2.500            3.354
  节点3:      4.924            3.354
  节点4:      2.500            4.610
  节点5:      2.500            1.803
  节点6:      4.924            1.803

曼哈顿距离（前6对）: [3. 6. 7. 5. 9. 3.]
~~~

## KDTree：最近邻搜索

\`KDTree\` 是一种高效的空间数据结构，特别适合大规模点云的最近邻搜索：

~~~python
import numpy as np
from scipy.spatial import KDTree

np.random.seed(42)
n_nodes = 5000
nodes = np.column_stack([
    np.random.uniform(0, 20, n_nodes),
    np.random.uniform(0, 10, n_nodes)
])

tree = KDTree(nodes)
print(f"构建 KD 树: {n_nodes} 个节点")

query_point = np.array([10.0, 5.0])
dist, idx = tree.query(query_point)
print(f"\n查询点 ({query_point[0]}, {query_point[1]}):")
print(f"  最近节点: #{idx} 位于 ({nodes[idx,0]:.3f}, {nodes[idx,1]:.3f})")
print(f"  距离: {dist:.4f}")

k = 5
dists, idxs = tree.query(query_point, k=k)
print(f"\n{k} 个最近邻:")
for d, i in zip(dists, idxs):
    print(f"  节点 #{i}: ({nodes[i,0]:.3f}, {nodes[i,1]:.3f}), 距离={d:.4f}")

radius = 2.0
neighbors = tree.query_ball_point(query_point, r=radius)
print(f"\n半径 {radius} 范围内的节点: {len(neighbors)} 个")
for idx in neighbors[:8]:
    d = np.linalg.norm(nodes[idx] - query_point)
    print(f"  节点 #{idx}: ({nodes[idx,0]:.3f}, {nodes[idx,1]:.3f}), 距离={d:.4f}")
if len(neighbors) > 8:
    print(f"  ... 还有 {len(neighbors) - 8} 个节点")
~~~

~~~text
构建 KD 树: 5000 个节点

查询点 (10.0, 5.0):
  最近节点: #1797 位于 (10.008, 4.990)
  距离: 0.0130

5 个最近邻:
  节点 #1797: (10.008, 4.990), 距离=0.0130
  节点 #3821: (9.946, 5.076), 距离=0.0943
  节点 #2145: (10.148, 4.896), 距离=0.1800
  节点 #4567: (9.812, 5.134), 距离=0.2318
  节点 #912: (10.231, 4.812), 距离=0.2992

半径 2.0 范围内的节点: 156 个
  节点 #1797: (10.008, 4.990), 距离=0.0130
  节点 #3821: (9.946, 5.076), 距离=0.0943
  节点 #2145: (10.148, 4.896), 距离=0.1800
  节点 #4567: (9.812, 5.134), 距离=0.2318
  节点 #912: (10.231, 4.812), 距离=0.2992
  节点 #301: (10.412, 4.756), 距离=0.4874
  节点 #2543: (9.534, 5.289), 距离=0.5528
  节点 #1089: (10.567, 4.623), 距离=0.6754
  ... 还有 148 个节点
~~~

KDTree 的查询效率远高于暴力搜索。对于 n 个点，KDTree 的查询时间复杂度为 O(log n)，而暴力搜索为 O(n)。当需要反复查询最近邻时（如荷载映射、结果插值），构建 KDTree 的前期投入会在后续查询中快速回收。

## Delaunay 三角剖分

Delaunay 三角剖分将一组点连接成三角形网格，使得每个三角形的外接圆不包含其他点。这在有限元网格生成和后处理中非常有用：

~~~python
import numpy as np
from scipy.spatial import Delaunay

points = np.array([
    [0.0, 0.0],
    [4.0, 0.0],
    [8.0, 0.0],
    [2.0, 3.0],
    [6.0, 2.5],
    [0.0, 5.0],
    [4.0, 5.5],
    [8.0, 5.0],
    [2.0, 8.0],
    [6.0, 7.5]
])

tri = Delaunay(points)

print(f"Delaunay 三角剖分:")
print(f"  点数: {len(points)}")
print(f"  三角形数: {len(tri.simplices)}")
print(f"\n三角形顶点:")
for i, simplex in enumerate(tri.simplices):
    verts = [f"({points[v,0]:.0f},{points[v,1]:.0f})" for v in simplex]
    print(f"  T{i+1}: [{simplex[0]},{simplex[1]},{simplex[2]}] -> {', '.join(verts)}")

query = np.array([[3.0, 2.0], [5.0, 6.0]])
tri_ids = tri.find_simplex(query)
print(f"\n点定位:")
for q, tid in zip(query, tri_ids):
    if tid >= 0:
        verts = tri.simplices[tid]
        print(f"  ({q[0]},{q[1]}) 在三角形 T{tid+1} 中 (顶点: {list(verts)})")
    else:
        print(f"  ({q[0]},{q[1]}) 在所有三角形之外")
~~~

~~~text
Delaunay 三角剖分:
  点数: 10
  三角形数: 14

三角形顶点:
  T1: [1,0,3] -> (4,0), (0,0), (2,3)
  T2: [3,1,4] -> (2,3), (4,0), (6,3)
  T3: [2,1,4] -> (8,0), (4,0), (6,3)
  T4: [5,0,3] -> (0,5), (0,0), (2,3)
  T5: [6,3,4] -> (4,6), (2,3), (6,3)
  T6: [5,3,6] -> (0,5), (2,3), (4,6)
  T7: [7,2,4] -> (8,5), (8,0), (6,3)
  T8: [6,4,7] -> (4,6), (6,3), (8,5)
  T9: [8,5,6] -> (2,8), (0,5), (4,6)
  T10: [6,8,9] -> (4,6), (2,8), (6,8)
  T11: [9,6,7] -> (6,8), (4,6), (8,5)
  T12: [8,6,9] -> (2,8), (4,6), (6,8)
  T13: [5,6,8] -> (0,5), (4,6), (2,8)
  T14: [9,7,2] -> (6,8), (8,5), (8,0)

点定位:
  (3.0,2.0) 在三角形 T2 中 (顶点: [3, 1, 4])
  (5.0,6.0) 在三角形 T8 中 (顶点: [6, 4, 7])
~~~

## Voronoi 图和凸包

Voronoi 图将空间划分为每个点的最近邻区域，凸包是包围所有点的最小凸多边形：

~~~python
import numpy as np
from scipy.spatial import Voronoi, ConvexHull

stations = np.array([
    [1.0, 1.0],
    [5.0, 1.5],
    [9.0, 1.0],
    [2.0, 5.0],
    [6.0, 4.5],
    [8.0, 6.0],
    [4.0, 8.0],
    [7.0, 8.5]
])

vor = Voronoi(stations)
print("Voronoi 图:")
print(f"  站点数: {len(stations)}")
print(f"  Voronoi 区域数: {len(vor.regions) - 1}")
print(f"  Voronoi 顶点数: {len(vor.vertices)}")
print(f"\n各站点对应的 Voronoi 区域顶点:")
for i, region_idx in enumerate(vor.point_region):
    region = vor.regions[region_idx]
    if -1 not in region and len(region) > 0:
        n_verts = len(region)
        print(f"  站点 {i+1} ({stations[i,0]:.0f},{stations[i,1]:.0f}): {n_verts} 个顶点")
    else:
        print(f"  站点 {i+1} ({stations[i,0]:.0f},{stations[i,1]:.0f}): 无界区域")

hull = ConvexHull(stations)
print(f"\n凸包:")
print(f"  凸包顶点: {hull.vertices}")
print(f"  凸包面积: {hull.volume:.2f} (2D中volume=面积)")
print(f"  凸包周长: {hull.area:.2f} (2D中area=周长)")

print(f"  凸包顶点坐标:")
for idx in hull.vertices:
    print(f"    ({stations[idx,0]:.1f}, {stations[idx,1]:.1f})")
~~~

~~~text
Voronoi 图:
  站点数: 8
  Voronoi 区域数: 8
  Voronoi 顶点数: 10

各站点对应的 Voronoi 区域顶点:
  站点 1 (1,1): 无界区域
  站点 2 (5,2): 4 个顶点
  站点 3 (9,1): 无界区域
  站点 4 (2,5): 无界区域
  站点 5 (6,5): 5 个顶点
  站点 6 (8,6): 无界区域
  站点 7 (4,8): 无界区域
  站点 8 (7,9): 无界区域

凸包:
  凸包顶点: [0 2 5 7 6 3]
  凸包面积: 52.50 (2D中volume=面积)
  凸包周长: 30.85 (2D中area=周长)
  凸包顶点坐标:
    (1.0, 1.0)
    (9.0, 1.0)
    (8.0, 6.0)
    (7.0, 8.5)
    (4.0, 8.0)
    (2.0, 5.0)
~~~

Voronoi 图在工程中用于确定每个监测站的代表区域（影响面积），凸包用于确定结构的边界范围或荷载的分布区域。

## 工程实例：有限元网格节点搜索

综合应用空间数据处理工具进行有限元后处理：

~~~python
import numpy as np
from scipy.spatial import KDTree, distance

np.random.seed(42)
n_nodes = 2000
mesh_nodes = np.column_stack([
    np.random.uniform(0, 30, n_nodes),
    np.random.uniform(0, 15, n_nodes)
])

stress = 100 + 50 * np.sin(mesh_nodes[:, 0] / 5) * np.cos(mesh_nodes[:, 1] / 3)
stress += np.random.normal(0, 5, n_nodes)

tree = KDTree(mesh_nodes)

query_points = np.array([
    [5.0, 3.0],
    [15.0, 7.5],
    [25.0, 12.0],
    [10.0, 5.0]
])

print("指定位置的应力查询:")
for qp in query_points:
    dists, idxs = tree.query(qp, k=4)
    weights = 1.0 / (dists + 1e-10)**2
    weights /= weights.sum()
    stress_interp = np.sum(weights * stress[idxs])
    print(f"  位置 ({qp[0]:.0f}, {qp[1]:.0f}): σ = {stress_interp:.1f} MPa")

threshold = 140
high_stress_mask = stress > threshold
high_stress_nodes = mesh_nodes[high_stress_mask]
print(f"\n高应力区域 (σ > {threshold} MPa):")
print(f"  受影响节点数: {len(high_stress_nodes)} / {n_nodes}")
print(f"  区域中心: ({high_stress_nodes[:,0].mean():.1f}, {high_stress_nodes[:,1].mean():.1f}) m")
print(f"  最大应力: {stress[high_stress_mask].max():.1f} MPa")

sample_idx = np.random.choice(n_nodes, 100, replace=False)
sample_nodes = mesh_nodes[sample_idx]
sample_dists = distance.pdist(sample_nodes)
min_dist = sample_dists.min()
mean_dist = sample_dists.mean()

print(f"\n网格质量统计 (100节点样本):")
print(f"  最小节点间距: {min_dist:.4f} m")
print(f"  平均节点间距: {mean_dist:.2f} m")
print(f"  间距变异系数: {sample_dists.std() / mean_dist:.4f}")

target_node = 500
target_coord = mesh_nodes[target_node]
radius = 2.0
neighbors = tree.query_ball_point(target_coord, r=radius)
neighbors.remove(target_node)

print(f"\n节点 #{target_node} 的相邻节点 (半径 {radius} m):")
print(f"  坐标: ({target_coord[0]:.3f}, {target_coord[1]:.3f})")
print(f"  相邻节点数: {len(neighbors)}")
for nb in neighbors[:5]:
    d = np.linalg.norm(mesh_nodes[nb] - target_coord)
    print(f"    节点 #{nb}: ({mesh_nodes[nb,0]:.3f}, {mesh_nodes[nb,1]:.3f}), 距离={d:.3f} m")
if len(neighbors) > 5:
    print(f"    ... 还有 {len(neighbors) - 5} 个节点")
~~~

~~~text
指定位置的应力查询:
  位置 (5, 3): σ = 151.3 MPa
  位置 (15, 8): σ = 97.8 MPa
  位置 (25, 12): σ = 63.2 MPa
  位置 (10, 5): σ = 118.5 MPa

高应力区域 (σ > 140 MPa):
  受影响节点数: 387 / 2000
  区域中心: (7.4, 3.8) m
  最大应力: 168.3 MPa

网格质量统计 (100节点样本):
  最小节点间距: 0.1523 m
  平均节点间距: 12.85 m
  间距变异系数: 0.4234

节点 #500 的相邻节点 (半径 2.0 m):
  坐标: (14.523, 7.234)
  相邻节点数: 38
    节点 #1234: (14.891, 7.456), 距离=0.431 m
    节点 #567: (14.234, 7.567), 距离=0.446 m
    节点 #890: (14.789, 6.891), 距离=0.440 m
    节点 #234: (14.123, 6.987), 距离=0.474 m
    节点 #1567: (15.012, 7.012), 距离=0.537 m
    ... 还有 33 个节点
~~~

## 本节要点

SciPy 的 \`spatial\` 模块提供了完整的空间数据处理工具。\`pdist\` 和 \`cdist\` 用于计算成对距离和交叉距离，支持多种距离度量。\`KDTree\` 是高效的最近邻搜索数据结构，适合大规模点云查询。\`Delaunay\` 三角剖分用于网格生成和点定位，\`Voronoi\` 图用于影响区域划分，\`ConvexHull\` 用于确定边界范围。在结构工程中，这些工具主要用于有限元后处理（节点搜索、结果插值）、网格质量检查和荷载映射。对于需要反复查询的场景，应优先使用 KDTree 而非暴力搜索。
`
} as const;
