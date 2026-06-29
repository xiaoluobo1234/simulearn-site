export const apdlMeshSolveTutorials = {
  'apdl-element-types': String.raw`
在 ANSYS 有限元分析中，单元类型决定了模型的物理行为、自由度数量和计算精度。每种单元类型都有特定编号和名称，分析前必须通过 ET 命令定义。合理选择单元类型是获得可靠结果的第一步，也是整个前处理中最关键的决策之一。

## ET 命令定义单元类型

ET 命令的基本格式为 \`ET,参考号,单元名称\`。参考号是用户指定的正整数标识，后续通过该编号引用单元类型。一个模型可以定义多种单元类型：

~~~apdl
/PREP7
! 定义三种常用结构单元
ET,1,SOLID185     ! 3D 8节点实体单元
ET,2,BEAM188      ! 3D 2节点梁单元
ET,3,SHELL181     ! 4节点壳体单元
~~~

执行后，ANSYS 会在单元类型列表中注册编号 1、2、3 对应的单元。可以通过 \`ETLIST\` 查看当前已定义的所有单元类型：

~~~apdl
ETLIST,ALL        ! 列出所有已定义单元类型
~~~

~~~text
  LIST ELEMENT TYPES      1 TO      3 BY      1
       1  SOLID185         3-D 8-NODE STRUCTURAL SOLID
       2  BEAM188          3-D 2-NODE BEAM
       3  SHELL181         4-NODE STRUCTURAL SHELL
~~~

删除不再需要的单元类型使用 \`ETDELE\` 命令：

~~~apdl
ETDELE,2          ! 删除参考号为2的单元类型
~~~

## 常用结构单元类型

SOLID185 是三维八节点实体单元，每个节点有三个平动自由度 UX、UY、UZ。它适用于大多数三维实体结构分析，支持大变形、大应变、塑性和蠕变等材料非线性。对于需要更高精度的场合，可以使用 SOLID186，它是三维二十节点高阶实体单元，对弯曲和应力集中的捕捉更为准确，但计算成本也更高。

SHELL181 是四节点壳体单元，每个节点有六个自由度（三个平动加三个转动）。它适合模拟薄壁到中等厚度的板壳结构，如压力容器壁、车身面板和飞机蒙皮。SHELL181 支持多层复合材料和截面偏移。

BEAM188 是三维两节点梁单元，基于 Timoshenko 梁理论，每个节点有六个或七个自由度。它适用于细长构件的模拟，如框架结构、管道支架和桥梁主梁。BEAM188 支持多种截面形状定义。

PLANE182 是二维四节点平面单元，每个节点有两个平动自由度 UX、UY。它可以模拟平面应力、平面应变和轴对称问题，是二维分析中最常用的单元之一。

LINK180 是三维杆单元，只承受轴向拉压，每个节点有三个平动自由度。它适合模拟桁架结构、拉索和连杆机构。

~~~apdl
! 二维分析的单元定义
ET,1,PLANE182     ! 2D 4节点平面单元
KEYOPT,1,3,1      ! 设置为平面应力模式

! 或者设置为平面应变模式
ET,2,PLANE182
KEYOPT,2,3,2      ! 平面应变

! 轴对称分析
ET,3,PLANE182
KEYOPT,3,3,1      ! 轴对称
~~~

## KEYOPT 设置单元选项

每种单元类型都有一组 KEYOPT 选项，用于控制单元的行为模式。命令格式为 \`KEYOPT,单元参考号,选项编号,选项值\`：

~~~apdl
ET,1,SHELL181
KEYOPT,1,3,2       ! 选择积分方案：增强应变公式
KEYOPT,1,8,2       ! 存储顶面和底面应力

ET,2,BEAM188
KEYOPT,2,3,2       ! 使用立方形函数（更精确的弯曲）
KEYOPT,2,4,1       ! 输出截面力/力矩
~~~

KEYOPT 设置必须在网格划分之前完成，否则部分选项可能不会生效。使用 \`KEYLIST\` 可以查看当前所有单元的 KEYOPT 设置：

~~~apdl
KEYLIST,ALL        ! 列出所有单元的KEYOPT
~~~

## 实常数与截面定义

传统 ANSYS 单元通过 R 命令定义实常数（Real Constants），如壳体厚度、梁截面面积和惯性矩。但现代 ANSYS 推荐使用 SECTYPE 和 SECDATA 来定义截面属性，这种方式更直观且功能更强大。

对于 SHELL181 单元，定义壳体厚度：

~~~apdl
! 传统方式（仍然支持但不推荐）
ET,1,SHELL181
R,1,0.01           ! 实常数集1，壳厚10mm

! 现代方式（推荐）
ET,1,SHELL181
SECTYPE,1,SHELL    ! 定义截面类型1为壳体
SECDATA,0.01       ! 壳体厚度10mm
~~~

对于 BEAM188 单元，SECTYPE 支持多种标准截面形状：

~~~apdl
ET,2,BEAM188

! 矩形截面 (宽0.1m，高0.2m)
SECTYPE,1,BEAM,RECT
SECDATA,0.1,0.2

! 实心圆截面 (半径0.05m)
SECTYPE,2,BEAM,CSOLID
SECDATA,0.05

! 圆管截面 (外径0.1m，壁厚0.005m)
SECTYPE,3,BEAM,PIPE
SECDATA,0.1,0.005
~~~

使用 \`SECLIST\` 和 \`SECPLOT\` 查看和绘制截面信息：

~~~apdl
SECLIST,ALL        ! 列出所有截面定义
SECPLOT,1          ! 绘制截面1的形状
SECPLOT,2          ! 绘制截面2的形状
~~~

## 单元坐标系与方向关键点

梁单元和壳单元都需要定义方向，否则 ANSYS 无法确定截面的朝向。对于 BEAM188，需要通过第三个节点或方向关键点来确定梁截面的局部 y 轴方向：

~~~apdl
! 创建带方向关键点的梁
K,1,0,0,0          ! 起点
K,2,5,0,0          ! 终点
K,3,0,1,0          ! 方向关键点（确定局部y轴）

L,1,2              ! 创建线
LATT,1,,2,,3,,1    ! 线属性：材料1，实常数空，类型2，
                    ! 方向关键点3，截面1

! 使用SECCONTROL设置梁截面偏移
SECCONTROL,,,0     ! 无偏移
~~~

对于 SHELL181，壳的法向方向由节点编号顺序决定。若法向方向不一致，可以使用 \`ENORM\` 命令统一壳单元法向：

~~~apdl
ENORM,ALL          ! 统一所有壳单元法向
~~~

## 如何选择合适的单元类型

选择单元类型时需要综合考虑几何特征、分析类型和计算资源。三维实体结构优先使用 SOLID185，当应力梯度较大或需要更高精度时改用 SOLID186。薄壁结构优先使用 SHELL181，可以显著减少单元数量。细长构件适合 BEAM188，避免用实体单元模拟细长梁导致计算规模过大。

二维问题中，平面应力适用于薄板面内受力，平面应变适用于厚壁长构件横截面，轴对称适用于旋转体结构。桁架和拉索使用 LINK180。

混合使用不同单元类型时，必须确保连接处的自由度兼容。例如实体单元只有平动自由度，而壳单元和梁单元还有转动自由度，直接连接会导致自由度不匹配，需要使用约束方程或耦合来处理。

~~~apdl
! 完整示例：定义混合模型
/PREP7

! 实体部分
ET,1,SOLID185
MP,EX,1,2.1e11
MP,PRXY,1,0.3

! 梁部分
ET,2,BEAM188
SECTYPE,1,BEAM,RECT
SECDATA,0.1,0.2

! 壳部分
ET,3,SHELL181
SECTYPE,2,SHELL
SECDATA,0.008

! 查看定义
ETLIST,ALL
SECLIST,ALL
~~~

## 本节要点

单元类型通过 ET 命令定义，参考号用于后续引用。SOLID185 适用于三维实体，SHELL181 适用于薄壁结构，BEAM188 适用于细长构件，PLANE182 适用于二维问题。KEYOPT 控制单元行为选项，必须在划分网格之前设置。现代 ANSYS 推荐使用 SECTYPE/SECDATA 定义梁和壳的截面属性，取代传统的 R 实常数。梁单元需要方向关键点确定截面朝向，壳单元的法向由节点编号顺序决定。选择单元类型时应综合考虑几何特征、分析精度需求和计算效率。
`,

  'apdl-material-props': String.raw`
材料属性是有限元模型中最基本的物理参数，直接影响分析结果的可靠性。ANSYS 中通过 MP 命令定义线性材料属性，通过 TB 命令定义非线性材料模型。材料可以按编号管理，也可以从材料库中加载。正确定义材料属性是确保仿真精度的基础。

## MP 命令定义线性各向同性属性

MP 命令的基本格式为 \`MP,属性标签,材料编号,属性值\`。最常用的结构材料属性包括弹性模量、泊松比、密度和热膨胀系数：

~~~apdl
/PREP7
! 定义结构钢材料 (材料编号1)
MP,EX,1,2.1e11     ! 弹性模量 210 GPa (Pa)
MP,PRXY,1,0.3      ! 泊松比 0.3
MP,DENS,1,7850     ! 密度 7850 kg/m³
MP,ALPX,1,1.2e-5   ! 线膨胀系数 1.2e-5 /°C
~~~

EX 表示 X 方向的弹性模量，对于各向同性材料只需定义一个方向。PRXY 是 XY 平面的泊松比。DENS 为密度，在动力分析和考虑自重的静力分析中必须定义。ALPX 是 X 方向的热膨胀系数，热应力分析时需要。

查看已定义的材料属性：

~~~apdl
MPLIST,ALL         ! 列出所有材料的所有属性
MPLOT,EX,1         ! 绘制材料1弹性模量随温度变化曲线
~~~

~~~text
  MATERIAL     1   EX      =   0.2100000E+12
  MATERIAL     1   PRXY    =   0.3000000
  MATERIAL     1   DENS    =   7850.000
  MATERIAL     1   ALPX    =   0.1200000E-04
~~~

## 定义多种材料

一个模型中可以包含多种材料。每种材料用唯一的编号区分，后续网格划分时通过 MAT 命令将材料编号分配给单元：

~~~apdl
! 铝合金 (材料编号2)
MP,EX,2,7.0e10     ! 弹性模量 70 GPa
MP,PRXY,2,0.33     ! 泊松比 0.33
MP,DENS,2,2700     ! 密度 2700 kg/m³
MP,ALPX,2,2.3e-5   ! 线膨胀系数 2.3e-5 /°C

! 铜 (材料编号3)
MP,EX,3,1.1e11     ! 弹性模量 110 GPa
MP,PRXY,3,0.34     ! 泊松比 0.34
MP,DENS,3,8900     ! 密度 8900 kg/m³

! 混凝土 (材料编号4)
MP,EX,4,3.0e10     ! 弹性模量 30 GPa
MP,PRXY,4,0.2      ! 泊松比 0.2
MP,DENS,4,2400     ! 密度 2400 kg/m³
~~~

删除材料属性使用 \`MPDELE\`，删除整个材料编号的所有属性：

~~~apdl
MPDELE,ALL,4       ! 删除材料4的所有属性
~~~

## 温度相关材料属性

许多材料的属性会随温度变化，尤其在高温环境下。MPTEMP 和 MPDATA 命令配合使用可以定义温度相关材料属性：

~~~apdl
! 定义温度点（必须升序排列）
MPTEMP,1,20,100,200,300,400,500

! 定义弹性模量随温度变化 (材料1)
MPDATA,EX,1,,2.1e11,2.05e11,2.0e11,1.95e11,1.85e11,1.7e11

! 定义泊松比随温度变化
MPDATA,PRXY,1,,0.3,0.3,0.31,0.31,0.32,0.33

! 定义热膨胀系数随温度变化
MPDATA,ALPX,1,,1.2e-5,1.25e-5,1.3e-5,1.35e-5,1.4e-5,1.5e-5
~~~

MPTEMP 中第一个参数 1 表示起始编号，后面是温度值列表。MPDATA 中属性标签后跟材料编号和两个逗号，然后是各温度点对应的属性值。温度点数量和属性值数量必须匹配。

查看温度相关材料曲线：

~~~apdl
MPLOT,EX,1         ! 绘制弹性模量-温度曲线
MPLOT,ALPX,1       ! 绘制热膨胀系数-温度曲线
~~~

## 非线性材料模型简介

对于超出弹性范围的分析，需要使用 TB 命令定义非线性材料模型。TB 命令的基本格式为 \`TB,材料模型标签,材料编号\`，后续通过 TBDATA 或 TBPT 提供模型参数：

~~~apdl
! 双线性等向强化塑性模型
TB,PLASTIC,1       ! 为材料1定义塑性
TBPT,DEFI,0.001,2.1e8    ! 第一个数据点：应变0.001，应力210MPa
TBPT,DEFI,0.1,2.5e8      ! 第二个数据点：应变0.1，应力250MPa

! 多线性等向强化
TB,NLISO,2         ! 为材料2定义多线性等向强化
TBPT,DEFI,0.002,1.4e8    ! 屈服点
TBPT,DEFI,0.01,1.8e8
TBPT,DEFI,0.05,2.2e8
TBPT,DEFI,0.10,2.5e8
~~~

蠕变模型用于高温长时间加载分析：

~~~apdl
! 隐式蠕变模型 (Norton蠕变律)
TB,CREEP,1,,,10    ! 材料1，隐式蠕变，Norton模型
TBDATA,1,1.5e-12   ! 蠕变常数C1
TBDATA,2,3.0       ! 应力指数n
TBDATA,3,0.0       ! 温度指数（不使用）
TBDATA,4,-150000   ! 激活能参数
~~~

使用 \`TBLIST\` 查看已定义的材料模型，\`TBPLOT\` 绘制应力-应变曲线：

~~~apdl
TBLIST,ALL          ! 列出所有材料模型
TBPLOT,PLASTIC,1    ! 绘制材料1的塑性曲线
TBPLOT,NLISO,2      ! 绘制材料2的多线性曲线
~~~

## 材料库与 MPCOPY

ANSYS 提供了内置材料库，可以直接加载常见材料属性，避免手动输入。也可以将自定义材料保存为库文件：

~~~apdl
! 从材料库加载 (假设已有库文件)
! 读取自定义材料库
MPREAD,'my_materials','mat'

! 复制材料属性
MPCOPY,10,1        ! 将材料1的所有属性复制到材料10
MP,EX,10,1.5e11    ! 修改材料10的弹性模量（不影响材料1）
~~~

MPCOPY 在需要基于已有材料微调参数时非常有用，可以保留大部分属性，只修改个别值。

## 阻尼属性与动力分析材料参数

动力分析（模态分析、谐响应分析、瞬态分析）中通常需要额外定义阻尼参数。阻尼描述结构在振动过程中能量耗散的能力，直接影响共振幅值和振动衰减速率：

~~~apdl
! 材料阻尼 (材料阻尼比)
MP,DMPR,1,0.02      ! 材料1的阻尼比为0.02 (2%)

! 不同材料阻尼差异很大
MP,DMPR,2,0.05      ! 铝合金阻尼比5%
MP,DMPR,4,0.05      ! 混凝土阻尼比5% (典型值)
~~~

钢材的阻尼比通常在百分之一到百分之二之间，混凝土结构约为百分之三到百分之五，橡胶和复合材料可能高达百分之十到百分之二十。动力分析中若忽略阻尼，共振响应会趋于无穷大，结果不可信。

选择材料时应注意：首先确认分析类型需要哪些属性（静力分析不需要密度，但动力分析必须定义）；其次核实单位制一致性（弹性模量用 Pa 时密度应为 kg/m³）；最后检查非线性模型参数的物理合理性，尤其是塑性数据中应力-应变曲线必须单调递增。

## 各向异性与正交各向异性材料

对于复合材料或木材等各向异性材料，需要分别定义各方向的属性：

~~~apdl
! 正交各向异性材料 (如单向碳纤维复合材料)
MP,EX,5,1.5e11     ! X方向弹性模量 150 GPa
MP,EY,5,1.0e10     ! Y方向弹性模量 10 GPa
MP,EZ,5,1.0e10     ! Z方向弹性模量 10 GPa
MP,PRXY,5,0.3      ! XY泊松比
MP,PRYZ,5,0.4      ! YZ泊松比
MP,PRXZ,5,0.3      ! XZ泊松比
MP,GXY,5,5.0e9     ! XY剪切模量
MP,GYZ,5,3.5e9     ! YZ剪切模量
MP,GXZ,5,5.0e9     ! XZ剪切模量
~~~

## 一个完整的材料定义示例

下面定义一个包含两种材料的结构模型前处理部分：

~~~apdl
/PREP7

! ========== 材料1：结构钢 ==========
MP,EX,1,2.1e11     ! 弹性模量 210 GPa
MP,PRXY,1,0.3      ! 泊松比 0.3
MP,DENS,1,7850     ! 密度 7850 kg/m³

! 钢材双线性塑性
TB,PLASTIC,1
TBPT,DEFI,0.001,2.35e8   ! 屈服点
TBPT,DEFI,0.15,3.5e8     ! 极限强度

! ========== 材料2：6061铝合金 ==========
MP,EX,2,6.9e10     ! 弹性模量 69 GPa
MP,PRXY,2,0.33     ! 泊松比 0.33
MP,DENS,2,2700     ! 密度 2700 kg/m³

! ========== 验证 ==========
MPLIST,ALL
TBLIST,ALL
~~~

~~~text
  MATERIAL     1   EX      =   0.2100000E+12
  MATERIAL     1   PRXY    =   0.3000000
  MATERIAL     1   DENS    =   7850.000
  MATERIAL     2   EX      =   0.6900000E+11
  MATERIAL     2   PRXY    =   0.3300000
  MATERIAL     2   DENS    =   2700.000
~~~

## 本节要点

MP 命令用于定义线性材料属性，EX 为弹性模量、PRXY 为泊松比、DENS 为密度、ALPX 为热膨胀系数。每种材料用唯一编号标识。MPTEMP 和 MPDATA 配合使用可以定义随温度变化的材料属性。TB 命令定义非线性材料模型，包括塑性、蠕变等。MPCOPY 可以复制材料属性到新编号。正交各向异性材料需要分别定义各方向的弹性模量、泊松比和剪切模量。材料定义完成后使用 MPLIST 和 TBLIST 验证，确保参数正确无误。
`,

  'apdl-meshing': String.raw`
网格划分是有限元前处理的核心步骤，将连续几何体离散为有限个单元和节点。网格质量直接影响求解精度和收敛性。ANSYS 提供了从全自动到完全手动的多层次网格控制能力，用户需要根据分析目的在精度和效率之间找到平衡。

## 网格划分的基本流程

ANSYS 网格划分遵循三步流程：分配属性、设置控制参数、执行网格划分。属性包括单元类型、材料编号和实常数或截面；控制参数决定单元大小和划分方式；执行命令根据几何类型选择 AMESH（面）、VMESH（体）或 LMESH（线）。

~~~apdl
/PREP7
! 第一步：定义属性
ET,1,SOLID185      ! 单元类型
MP,EX,1,2.1e11     ! 材料属性
MP,PRXY,1,0.3
MP,DENS,1,7850

! 分配体属性
VATT,1,,1          ! 材料1，无实常数，单元类型1

! 第二步：设置网格尺寸
ESIZE,,3           ! 全局控制，每个边至少分3段

! 第三步：执行网格划分
VMESH,ALL          ! 对所有体执行网格划分
~~~

## 属性分配命令

AATT 用于面，VATT 用于体，LATT 用于线。命令格式统一为 \`XATT,MAT,REAL,TYPE,ESYS,SECN\`，分别对应材料编号、实常数集号、单元类型编号、单元坐标系和截面编号：

~~~apdl
! 面属性分配 (用于壳体模型)
ET,1,SHELL181
SECTYPE,1,SHELL
SECDATA,0.01       ! 壳厚10mm
MP,EX,1,2.1e11
MP,PRXY,1,0.3

AATT,1,,1,,1       ! 所有面使用材料1、类型1、截面1

! 体属性分配 (用于实体模型)
ET,2,SOLID185
MP,EX,2,7.0e10
MP,PRXY,2,0.33
VATT,2,,2          ! 所有体使用材料2、类型2

! 线属性分配 (用于梁模型)
ET,3,BEAM188
SECTYPE,2,BEAM,RECT
SECDATA,0.1,0.2
MP,EX,3,2.1e11
MP,PRXY,3,0.3

LATT,3,,3,,3,,2    ! 材料3、类型3、方向KP3、截面2
~~~

TYPE、MAT、REAL 等命令也可以全局设置默认值，之后创建的几何或划分网格时自动使用：

~~~apdl
TYPE,1             ! 默认使用单元类型1
MAT,1              ! 默认使用材料1
REAL,1             ! 默认使用实常数集1
~~~

## 单元尺寸控制

ESIZE 控制全局默认单元尺寸，LESIZE 控制指定线的划分密度，KESIZE 控制关键点附近的单元大小。局部控制的优先级高于全局控制：

~~~apdl
! 全局尺寸控制
ESIZE,0.05         ! 默认单元边长约0.05m
ESIZE,,5           ! 或：每条线至少分5段

! 线尺寸控制 (更精细)
LESIZE,1,,,10      ! 线1分为10段
LESIZE,2,,,8       ! 线2分为8段
LESIZE,ALL,,,5     ! 所有线至少分5段

! 关键点尺寸控制 (应力集中区域)
KESIZE,1,0.005     ! 关键点1附近单元尺寸0.005m
KESIZE,ALL,0.01    ! 所有关键点附近尺寸0.01m

! 线划分比例 (渐密网格)
LESIZE,5,,,10,5    ! 线5分10段，首尾比5:1
~~~

## 智能网格划分 SMRTSIZE

SMRTSIZE 根据几何特征自动调节网格密度，在曲率大和靠近孔洞的区域自动加密。取值范围 1（最密）到 10（最粗），默认值通常为 6：

~~~apdl
SMRTSIZE,1         ! 最精细的智能网格
SMRTSIZE,5         ! 中等密度
SMRTSIZE,FIN       ! 精细级别 (等同于较小数值)
SMRTSIZE,COAR      ! 粗糙级别
SMRTSIZE,DEFA      ! 恢复默认
~~~

智能网格划分与手动尺寸控制可以结合使用。当 SMRTSIZE 激活时，它会自动调整 LESIZE 和 KESIZE 的设置。如果需要完全手动控制，应关闭 SMRTSIZE：

~~~apdl
SMRTSIZE,OFF       ! 关闭智能网格划分
~~~

## 自由网格与映射网格

MSHKEY 命令控制网格划分方式。自由网格（MSHKEY,0）适用于任意形状，映射网格（MSHKEY,1）要求几何满足特定拓扑条件，但通常质量更高：

~~~apdl
! 自由网格 (适用于复杂几何)
MSHKEY,0
MSHAPE,1,3D       ! 三维优先使用四面体单元
AMESH,ALL          ! 对所有面划分自由网格

! 映射网格 (需要规则几何)
MSHKEY,1
MSHAPE,0,2D       ! 二维使用四边形单元
AMESH,ALL          ! 划分映射网格 (面必须是3或4条边)
~~~

映射网格对面和体的几何有严格限制：面必须是三边或四边形，对边必须有相同的分段数；体必须是四、五或六面体，对面网格模式必须匹配。不满足条件时 ANSYS 会自动退回到自由网格。

MSHAPE 控制单元形状偏好：对于二维，0 表示四边形、1 表示三角形；对于三维，0 表示六面体、1 表示四面体：

~~~apdl
MSHAPE,0,2D       ! 2D优先四边形
MSHAPE,1,2D       ! 2D优先三角形
MSHAPE,0,3D       ! 3D优先六面体
MSHAPE,1,3D       ! 3D优先四面体
~~~

## 网格划分执行与质量检查

AMESH 划分面网格，VMESH 划分体网格，LMESH 划分线网格。可以指定具体编号范围：

~~~apdl
AMESH,1,5          ! 划分面1到面5
VMESH,ALL          ! 划分所有体
LMESH,2            ! 只划分线2
~~~

划分完成后需要检查网格质量。SHPP 命令显示网格质量统计：

~~~apdl
SHPP,SUMM          ! 显示网格质量概要
SHPP,ON            ! 打开网格质量检查
~~~

~~~text
  ELEMENT QUALITY STATISTICS
  --------------------------
  Number of elements checked     =     1250
  Worst aspect ratio             =    5.23
  Worst Jacobian ratio           =    0.85
  Number of warning elements     =       3
~~~

若质量不佳，可以使用 EREFIN 进行局部加密：

~~~apdl
EREFIN,ALL,,,1,1   ! 对所有单元进行一次细化
! 或只细化特定区域
NSEL,S,LOC,X,0     ! 选择X=0附近的节点
ESEL,S,NODE,,ALL   ! 选择关联单元
EREFIN,ALL         ! 只细化选中区域的单元
ALLSEL             ! 重新选择全部
~~~

## 清除与重新划分

如果网格不满意，可以清除后重新划分。ACLEAR 和 VCLEAR 只删除节点和单元，不删除几何体本身：

~~~apdl
ACLEAR,ALL         ! 清除所有面的网格
VCLEAR,ALL         ! 清除所有体的网格

! 重新设置控制参数后再划分
ESIZE,,8
VMESH,ALL          ! 用更密的网格重新划分
~~~

如果需要删除几何，使用 ADELE 和 VDELE。重新划分网格前，建议先清除旧网格，否则 ANSYS 可能在旧网格基础上叠加新单元，导致重复节点和错误结果。

## 网格收敛性验证

网格密度对计算结果有直接影响。过于粗糙的网格会低估应力峰值，过于细密的网格则浪费计算资源。工程实践中通常进行网格收敛性分析：先用较粗网格计算，逐步加密并比较关键位置的结果（如最大应力、最大位移），直到结果不再随网格加密发生显著变化。一般认为连续两次加密的结果差异小于百分之五时即可认为收敛。关键区域（孔洞、圆角、载荷作用点附近）应优先加密，远离应力集中的区域可以使用较粗网格以节省计算时间。

## 实战：带孔方板的网格划分

以下示例对一个中心有圆孔的方板分别进行自由网格和映射网格划分，并比较结果：

~~~apdl
/PREP7
! 创建带孔方板几何
BLC4,0,0,0.2,0.2       ! 200mm×200mm方板
CYL4,0.1,0.1,0.02      ! 中心圆孔半径20mm
ASBA,1,2                ! 布尔减：方板减去圆

! 定义属性
ET,1,PLANE182
KEYOPT,1,3,3           ! 平面应力+厚度
R,1,0.005              ! 板厚5mm
MP,EX,1,2.1e11
MP,PRXY,1,0.3

AATT,1,1,1

! --- 自由网格 ---
MSHKEY,0
ESIZE,,4
AMESH,ALL
! 查看网格质量
SHPP,SUMM

! 清除后使用映射网格
ACLEAR,ALL

! --- 映射网格 (需要对面进行切分) ---
! 先用工作平面切分面，使其满足映射条件
WPCSYS,-1,0            ! 将工作平面移到全局坐标
WPOFFS,0.1,0.1         ! 移到圆心位置
ASBW,ALL               ! 用工作平面切分面

MSHKEY,1
MSHAPE,0,2D
LESIZE,ALL,,,6
AMESH,ALL
SHPP,SUMM
~~~

## 本节要点

网格划分遵循属性分配、尺寸控制、执行划分三步流程。AATT/VATT/LATT 将材料、单元类型和截面分配给几何。ESIZE 控制全局尺寸，LESIZE 和 KESIZE 提供局部精细控制。SMRTSIZE 根据几何特征自动调节密度。MSHKEY,0 为自由网格，适合复杂几何；MSHKEY,1 为映射网格，质量更高但要求规则拓扑。AMESH/VMESH/LMESH 执行划分。划分后务必使用 SHPP 检查网格质量，不满意时通过 ACLEAR 清除并重新划分。
`,

  'apdl-loads-bc': String.raw`
约束和载荷是有限元分析中定义边界条件的两个核心部分。约束（边界条件）限制模型的刚体运动并模拟实际支撑；载荷模拟外部作用力、压力、温度等物理效应。ANSYS 允许在几何实体（关键点、线、面）或有限元实体（节点、单元）上施加边界条件，两种方式各有优缺点。

## 位移约束 D 命令

D 命令是最常用的约束命令，用于限制节点的自由度。基本格式为 \`D,节点编号,自由度标签,约束值\`：

~~~apdl
! 固定节点1的所有平动自由度
D,1,UX,0           ! 限制X方向位移为0
D,1,UY,0           ! 限制Y方向位移为0
D,1,UZ,0           ! 限制Z方向位移为0

! 简写：固定节点1的全部自由度
D,1,ALL,0

! 在一组节点上施加约束
D,10,UX,0          ! 节点10的X位移为0
D,20,UX,0          ! 节点20的X位移为0

! 对所有选中节点施加约束
NSEL,S,LOC,Y,0     ! 选择Y=0处所有节点
D,ALL,UY,0         ! 限制Y方向位移
D,ALL,UX,0
D,ALL,UZ,0
ALLSEL             ! 重新选择全部
~~~

约束值不一定为零。可以施加非零位移来模拟强制位移或预定位移：

~~~apdl
! 在节点100施加5mm的强制位移
D,100,UY,0.005     ! Y方向位移5mm

! 施加转角约束 (梁/壳单元)
D,1,ROTX,0         ! 限制绕X轴的转动
D,1,ROTY,0
D,1,ROTZ,0
~~~

使用 DL 和 DA 命令在几何线上和面上施加约束，ANSYS 会在求解前自动转换到节点上：

~~~apdl
! 在线1上固定UY
DL,1,,UY,0

! 在面3上固定全部自由度
DA,3,ALL,0

! 在关键点1上固定UX
DK,1,UX,0
~~~

## 对称与反对称边界条件

对称面上，法向位移和面内转动为零；反对称面上，面内位移和法向转动为零。DSYM 命令可以快速施加这些条件：

~~~apdl
! 对称边界条件 (在Y=0面上)
NSEL,S,LOC,Y,0
DSYM,SYMM,Y        ! Y面对称条件
ALLSEL

! 反对称边界条件
NSEL,S,LOC,X,0
DSYM,ASYM,X        ! X面反对称条件
ALLSEL
~~~

使用对称条件可以将模型缩小为一半或四分之一，显著降低计算量。但必须确保几何、材料和载荷都满足对称性。

## 节点力 F 命令

F 命令用于在节点上施加集中力或力矩。格式为 \`F,节点编号,自由度标签,力值\`：

~~~apdl
! 在节点100施加Y方向-1000N的力
F,100,FY,-1000

! 在节点50施加X方向500N的力
F,50,FX,500

! 在节点上施加力矩 (梁/壳单元才有转动自由度)
F,10,MZ,200        ! 绕Z轴力矩200 N·m

! 在一组节点上施加分布力
NSEL,S,LOC,X,0.5   ! 选择X=0.5处的节点
*GET,ncount,NODE,,COUNT   ! 获取节点数量
F,ALL,FY,-10000/ncount    ! 均分10000N总力
ALLSEL
~~~

FK、FL、FA 分别在关键点、线和面上施加力，ANSYS 在求解前自动分配到节点：

~~~apdl
FK,1,FY,-5000      ! 在关键点1施加5000N力
FL,2,FY,-1000      ! 在线2上施加分布力
~~~

## 面载荷与压力

SF 命令在面上施加分布面载荷（如压力），SFE 在单元面上施加，SFL 在线上施加：

~~~apdl
! 在面1上施加1MPa均布压力
SF,1,PRES,1e6

! 在所有面上施加压力
SF,ALL,PRES,2e5    ! 0.2 MPa

! 在单元面上施加压力 (更精确的控制)
SFE,100,1,PRES,,5e5  ! 单元100的面1施加0.5MPa

! 在线上施加线压力 (2D分析)
SFL,3,PRES,1e6     ! 线3上施加1MPa线压力
~~~

负值压力表示方向与面法向相反（吸力），正值表示沿法向向内（压入）。面载荷可以是非均匀分布的，通过定义梯度或使用函数加载实现：

~~~apdl
! 线性梯度压力 (沿Y方向每米增加10000Pa)
SFE,ALL,1,PRES,,10000,0,0,1
! 其中最后四个参数：基准值、X梯度、Y梯度、Z梯度
~~~

## 体载荷与温度

BFA、BFE、BF 命令施加体载荷，如温度、重力体力和内热源：

~~~apdl
! 在所有节点上施加均匀温度100°C
BF,ALL,TEMP,100

! 在体1上施加温度载荷
BFA,1,TEMP,200

! 在特定单元上施加温度
BFE,1,TEMP,,150    ! 单元1温度150°C
~~~

温度载荷在热应力分析中非常重要。当结构受到温度变化且存在约束时，会产生热应力。温度值可以是节点温度（从热分析传递），也可以是直接施加的均匀温度。

## 重力与加速度载荷

ACEL 命令施加平移加速度（如重力），OMEGA 命令施加旋转角速度（如离心力）：

~~~apdl
! 施加重力加速度 (Y方向向下, g=9.81 m/s²)
ACEL,0,9.81,0      ! X,Y,Z方向加速度

! 注意：ACEL方向与重力方向相反
! 重力向下，加速度向上，所以Y方向为正

! 旋转角速度 (离心力)
OMEGA,0,0,100      ! 绕Z轴旋转，角速度100 rad/s

! 同时考虑重力和旋转
ACEL,0,9.81,0
OMEGA,0,0,50       ! 50 rad/s绕Z轴
~~~

施加惯性载荷时必须定义材料密度（MP,DENS），否则 ANSYS 无法计算惯性力。

惯性释放（Inertia Relief）用于无约束结构的静力分析，如飞行中的飞机：

~~~apdl
IRLF,1             ! 开启惯性释放
! ANSYS会自动计算加速度以平衡外力
~~~

## 几何载荷与有限元载荷的区别

在几何上施加约束和载荷（DK、DL、DA、FK、FL、FA、SFL、BFA）更直观，修改网格后载荷自动保留。在有限元上施加（D、F、SF、SFE、BF、BFE）更精确，但重新划分网格后载荷丢失。

ANSYS 在求解时会自动将几何上的载荷转换到有限元节点上，转换命令为 SBCTRAN：

~~~apdl
! 在几何上施加载荷
DA,1,ALL,0         ! 面1固定
FA,2,FY,-10000     ! 面2上施加力

! 手动转换几何载荷到节点
SBCTRAN            ! 将面/线/关键点载荷转换为节点载荷

! 查看转换后的节点载荷
FLIST              ! 列出所有节点力
DLIST              ! 列出所有节点约束
~~~

通常不需要手动调用 SBCTRAN，ANSYS 在 SOLVE 时会自动执行转换。但在需要检查载荷分配情况时，手动转换可以帮助验证。

## 删除已施加的约束和载荷

~~~apdl
DDELE,ALL,ALL      ! 删除所有节点的约束
FDELE,ALL          ! 删除所有节点力
SFDELE,ALL,PRES    ! 删除所有压力载荷
BFDELE,ALL,TEMP    ! 删除所有温度载荷
ACEL               ! 清除加速度 (不填参数)
OMEGA              ! 清除角速度
~~~

## 实战：简支梁加载示例

~~~apdl
/PREP7
! 创建简支梁模型
ET,1,BEAM188
MP,EX,1,2.1e11
MP,PRXY,1,0.3
MP,DENS,1,7850

SECTYPE,1,BEAM,RECT
SECDATA,0.1,0.3    ! 100mm×300mm矩形截面

! 创建几何
K,1,0,0,0
K,2,5,0,0
K,3,0,1,0          ! 方向关键点
L,1,2
LATT,1,,1,,3,,1    ! 分配属性

! 网格划分
LESIZE,ALL,,,20
LMESH,ALL

! 施加约束
! 左端：铰支（固定平动，释放转动）
D,1,UX,0
D,1,UY,0
D,1,UZ,0

! 右端：滚动支座（只限制Y方向）
NSEL,S,LOC,X,5
D,ALL,UY,0
ALLSEL

! 施加均布载荷 (重力)
ACEL,0,9.81,0

! 施加集中力
NSEL,S,LOC,X,2.5
F,ALL,FY,-10000    ! 中点10kN集中力
ALLSEL

! 查看载荷
DLIST
FLIST
~~~

## 本节要点

D 命令约束节点自由度，F 命令施加节点集中力。DL/DA/DK 在几何上施加约束，求解时自动转换到节点。SF/SFE/SFL 施加面载荷和压力，BF/BFA/BFE 施加体载荷和温度。ACEL 施加重力加速度（方向与重力相反），OMEGA 施加旋转角速度。施加惯性载荷时必须定义材料密度。几何上施加载荷便于网格修改，有限元上施加载荷便于精确控制。使用 DDELE、FDELE、SFDELE 等命令删除已有约束和载荷。
`,

  'apdl-load-steps': String.raw`
载荷步（Load Step）是 ANSYS 中组织多个加载阶段的核心机制。一个分析可以包含多个载荷步，每个载荷步代表一组特定的载荷和边界条件组合。载荷步的概念即使在静力分析中也非常重要，因为 ANSYS 使用"时间"作为追踪参数来区分不同的加载阶段，尽管物理上可能是准静态过程。

## 载荷步与子步的基本概念

载荷步定义了一组完整的载荷和约束条件，子步（Substep）是载荷步内部的增量步。在静力分析中，子步用于逐步施加载荷以改善收敛性；在非线性分析中，子步是牛顿-拉弗森迭代的增量区间；在瞬态分析中，子步对应时间增量。

一个典型的载荷步设置包括：载荷和约束定义、加载方式（阶跃或斜坡）、子步数量、输出控制。

~~~apdl
/SOLU
! ===== 载荷步1：仅自重 =====
ACEL,0,9.81,0           ! 重力加速度
KBC,0                   ! 斜坡加载 (从0逐渐增加到满值)
NSUBST,5                ! 5个子步
OUTRES,ALL,LAST         ! 只保存最后子步的结果
TIME,1                  ! 时间标记为1
LSWRITE,1               ! 写入载荷步文件1

! ===== 载荷步2：自重+压力 =====
SF,ALL,PRES,1e6         ! 施加1MPa压力
KBC,1                   ! 阶跃加载 (直接加满值)
NSUBST,3                ! 3个子步
OUTRES,ALL,ALL          ! 保存所有子步的结果
TIME,2                  ! 时间标记为2
LSWRITE,2               ! 写入载荷步文件2

! ===== 载荷步3：自重+压力+温度 =====
BF,ALL,TEMP,150         ! 施加150°C温度
KBC,0
NSUBST,10               ! 10个子步 (温度载荷可能需要更多子步收敛)
OUTRES,ALL,ALL
TIME,3
LSWRITE,3               ! 写入载荷步文件3
~~~

## KBC 命令：阶跃与斜坡加载

KBC 控制载荷在载荷步内的施加方式。KBC,0 表示斜坡加载，载荷从上一载荷步的值线性增加到当前载荷步的值；KBC,1 表示阶跃加载，载荷在载荷步开始时立即跳到目标值：

~~~apdl
! 斜坡加载：适合缓慢增加的载荷
KBC,0
NSUBST,10              ! 载荷从0逐渐增加到满值，分10个子步

! 阶跃加载：适合突然施加的载荷
KBC,1
NSUBST,1               ! 载荷立即施加，通常1个子步即可

! 注意：第一个载荷步总是从"零"状态开始
! 因此第一个载荷步的KBC,0和KBC,1效果相同
~~~

选择加载方式取决于物理实际。重力从零逐渐建立适合斜坡加载；冲击载荷突然施加适合阶跃加载。非线性分析中，斜坡加载更容易收敛。

## NSUBST 子步控制

NSUBST 命令的完整格式为 \`NSUBST,初始子步数,最大子步数,最小子步数\`。当 ANSYS 在某子步不收敛时，会自动将子步减半重试（二分法），但不小于最小子步数：

~~~apdl
! 固定子步数
NSUBST,10              ! 10个等间隔子步

! 自适应子步 (推荐用于非线性分析)
NSUBST,10,100,5        ! 初始10步，最多100步，最少5步
! 如果某子步不收敛，ANSYS自动将步长减半重试
! 如果收敛很快，ANSYS会自动增大步长

! 结合AUTOTS自动时间步
AUTOTS,ON              ! 开启自动时间步长调整
NSUBST,5,50,2          ! ANSYS根据收敛情况自动调节
~~~

## OUTRES 输出控制

OUTRES 控制哪些结果数据保存到结果文件中。过多的输出会显著增大文件体积，过少则后处理时无法查看需要的结果：

~~~apdl
OUTRES,ALL,ALL         ! 保存所有结果到所有子步 (文件最大)
OUTRES,ALL,LAST        ! 只保存每个载荷步最后子步的结果
OUTRES,ALL,NONE        ! 不保存任何结果
OUTRES,NSOL,ALL        ! 只保存节点解 (位移) 到所有子步
OUTRES,ESOL,ALL        ! 只保存单元解 (应力应变) 到所有子步
OUTRES,RSOL,ALL        ! 只保存反力到所有子步

! 间隔输出：每3个子步保存一次
OUTRES,ALL,,3

! 组合使用：不同频率保存不同类型
OUTRES,NSOL,ALL        ! 位移每步保存
OUTRES,ESOL,,5         ! 应力每5步保存
OUTRES,RSOL,LAST       ! 反力只保存最后一步
~~~

## LSWRITE 与 LSSOLVE

LSWRITE 将当前载荷步设置写入文件（.S01, .S02, ...），LSSOLVE 按顺序读取这些文件并依次求解：

~~~apdl
/SOLU
ANTYPE,STATIC          ! 静力分析

! 定义载荷步1
ACEL,0,9.81,0
KBC,0
NSUBST,5
TIME,1
OUTRES,ALL,LAST
LSWRITE,1              ! 保存为jobname.S01

! 定义载荷步2
F,100,FY,-5000
KBC,1
NSUBST,3
TIME,2
OUTRES,ALL,ALL
LSWRITE,2              ! 保存为jobname.S02

! 定义载荷步3
SF,ALL,PRES,2e5
KBC,0
NSUBST,5,20,3
TIME,3
OUTRES,ALL,ALL
LSWRITE,3              ! 保存为jobname.S03

! 一次性求解所有载荷步
LSSOLVE,1,3            ! 从载荷步1求解到载荷步3
~~~

LSSOLVE 的格式为 \`LSSOLVE,起始步,结束步,步长\`。可以跳过某些载荷步，例如 \`LSSOLVE,1,5,2\` 只求解第1、3、5步。

## 时间作为追踪参数

即使在不涉及时间效应的静力分析中，ANSYS 也使用时间值来标记和区分不同的载荷步。TIME 命令设置当前载荷步结束时的时间值，默认每个载荷步的时间递增 1：

~~~apdl
! 第一个载荷步：TIME默认为1
! 第二个载荷步：TIME默认为2

! 也可以手动设置时间值
TIME,0.5               ! 载荷步1在t=0.5结束
! ...
LSWRITE,1

TIME,1.0               ! 载荷步2在t=1.0结束
! ...
LSWRITE,2

TIME,2.5               ! 载荷步3在t=2.5结束
! ...
LSWRITE,3
~~~

后处理中通过时间值来读取特定载荷步的结果，因此合理设置时间值有助于结果管理。

## 载荷步管理注意事项

载荷步之间的载荷具有累加性：后续载荷步中未重新定义的载荷会保持上一载荷步的值。因此如果需要移除某个载荷，必须显式将其设为零。例如在第二步中不再需要压力载荷，应该写 \`SF,ALL,PRES,0\` 而非忽略它。此外，约束条件的改变同样需要显式操作：用 \`DDELE\` 删除不再需要的约束，用 \`D\` 添加新的约束。

载荷步文件（.S01, .S02 等）保存在工作目录中，如果需要修改某个载荷步，可以重新运行相应的设置命令并再次执行 \`LSWRITE\`，新文件会覆盖旧文件。求解之前使用 \`LSREAD\` 可以检查载荷步文件内容是否正确。

## 实战：悬臂梁多步加载分析

下面是一个完整的悬臂梁多步加载分析，依次施加重力、端部集中力和均布压力：

~~~apdl
/PREP7
! 模型定义
ET,1,BEAM188
MP,EX,1,2.1e11
MP,PRXY,1,0.3
MP,DENS,1,7850

SECTYPE,1,BEAM,RECT
SECDATA,0.15,0.3       ! 150mm×300mm截面

! 创建悬臂梁几何
K,1,0,0,0
K,2,6,0,0
K,3,0,1,0              ! 方向关键点
L,1,2
LATT,1,,1,,3,,1

! 网格
LESIZE,ALL,,,30
LMESH,ALL

! 固定端约束
D,1,ALL,0

! ===== 求解设置 =====
/SOLU
ANTYPE,STATIC

! --- 载荷步1：自重 ---
ACEL,0,9.81,0
KBC,0
NSUBST,3
OUTRES,ALL,ALL
TIME,1
LSWRITE,1

! --- 载荷步2：自重+端部力 ---
NSEL,S,LOC,X,6
F,ALL,FY,-20000        ! 自由端20kN向下
ALLSEL
KBC,1
NSUBST,5
OUTRES,ALL,ALL
TIME,2
LSWRITE,2

! --- 载荷步3：自重+端部力+均布载荷 ---
LSEL,S,LINE,,1
SFL,ALL,PRES,5000      ! 5kN/m均布载荷
ALLSEL
KBC,0
NSUBST,5,20,3
OUTRES,ALL,ALL
TIME,3
LSWRITE,3

! 求解所有载荷步
LSSOLVE,1,3
FINISH
~~~

求解完成后，可以在后处理中按时间值读取各载荷步的结果，观察结构在不同加载阶段下的响应变化。

## 本节要点

载荷步用于组织多个加载阶段，子步是载荷步内的增量步。KBC,0 为斜坡加载，载荷逐渐增加；KBC,1 为阶跃加载，载荷立即施加。NSUBST 控制子步数量，非线性分析推荐使用自适应子步配合 AUTOTS。OUTRES 控制结果输出频率和内容类型。LSWRITE 将载荷步设置写入文件，LSSOLVE 按顺序批量求解。TIME 命令设置时间标记，即使静力分析也用作载荷步追踪参数。合理设置子步数和输出控制可以兼顾计算效率和结果完整性。
`,

  'apdl-solving': String.raw`
求解器是 ANSYS 有限元分析的计算引擎，负责求解大型线性方程组或特征值问题。选择合适的分析类型和求解器直接影响计算速度、内存消耗和结果精度。ANSYS 提供了多种求解器，每种针对不同的问题规模和类型有各自的优势。

## 分析类型 ANTYPE

ANTYPE 命令设置分析类型，必须在求解开始前指定。常用的结构分析类型包括：

~~~apdl
/SOLU
ANTYPE,STATIC          ! 静力分析 (默认, ANTYPE,0)
ANTYPE,MODAL           ! 模态分析 (ANTYPE,2)
ANTYPE,HARMIC          ! 谐响应分析 (ANTYPE,3)
ANTYPE,TRANS           ! 瞬态分析 (ANTYPE,4)
ANTYPE,BUCKLE          ! 屈曲分析 (ANTYPE,5)
ANTYPE,SUBSTR          ! 子结构分析 (ANTYPE,7)
~~~

静力分析计算结构在静载荷下的位移、应力和应变。模态分析求解结构的固有频率和振型。谐响应分析计算结构在正弦载荷下的稳态响应。瞬态分析求解随时间变化的载荷响应。屈曲分析预测结构的屈曲载荷和屈曲模态。

修改分析类型时必须先退出求解器，重新进入后再设置：

~~~apdl
FINISH
/SOLU
ANTYPE,MODAL           ! 切换到模态分析
~~~

## 静力分析

静力分析是最常用的分析类型，可以是线性或非线性。线性静力分析假设小变形和线性材料，求解速度快。非线性分析考虑大变形、材料非线性和接触，需要迭代求解：

~~~apdl
/SOLU
ANTYPE,STATIC          ! 静力分析
NLGEOM,ON              ! 开启大变形效应 (几何非线性)
NROPT,FULL             ! 完全Newton-Raphson迭代

! 载荷和约束
D,1,ALL,0
F,100,FY,-5000
ACEL,0,9.81,0

! 求解控制
NSUBST,10,50,5         ! 自适应子步
OUTRES,ALL,ALL

! 开始求解
SOLVE
~~~

SOLCONTROL 命令可以一键设置推荐的非线性求解参数：

~~~apdl
SOLCONTROL,ON          ! 开启智能求解控制 (推荐)
! ANSYS自动设置合理的子步数、收敛准则和迭代次数
~~~

## 模态分析

模态分析求解结构的固有频率和振型，是动力学分析的基础。MODOPT 命令选择模态提取方法：

~~~apdl
/SOLU
ANTYPE,MODAL           ! 模态分析

! 选择模态提取方法
MODOPT,LANB,10         ! Block Lanczos法，提取前10阶模态
! 或
MODOPT,SUBSP,10        ! Subspace迭代法，提取前10阶
! 或
MODOPT,PCGLANB,10      ! PCG Lanczos法，适合大型模型

! 设置频率范围 (可选)
MXPAND,10,,,YES        ! 扩展前10阶模态，计算应力
FREQ,0,1000            ! 只搜索0到1000Hz范围内的模态

! 施加约束 (模态分析中只能施加约束，不能施加力)
D,1,ALL,0
NSEL,S,LOC,X,0
D,ALL,ALL,0
ALLSEL

! 求解
SOLVE
~~~

Block Lanczos 法是目前最推荐的模态提取方法，适合中大型模型的大规模模态提取。Subspace 迭代法适合小型模型提取少量模态。PCG Lanczos 利用迭代求解器，适合超大规模模型。

~~~text
  ***** EIGENVALUE EXTRACTION COMPLETE *****
  MODE NO.   FREQUENCY (HZ)
      1         12.345
      2         45.678
      3         78.901
      4        123.456
      5        167.890
~~~

## 求解器选择 EQSLV

EQSLV 命令选择方程求解器。不同求解器在速度、内存和适用范围上有显著差异：

~~~apdl
! 稀疏矩阵直接求解器 (默认，最稳健)
EQSLV,SPARSE

! PCG迭代求解器 (适合大型模型，内存占用少)
EQSLV,PCG

! ICCG迭代求解器 (适合病态矩阵)
EQSLV,ICCG

! 波前求解器 (老式求解器，兼容性好)
EQSLV,FRONT
~~~

稀疏求解器（SPARSE）是默认选项，属于直接求解器。它非常稳健，几乎能处理所有结构问题，但内存消耗较大。对于超过百万自由度的模型，内存可能不足。

PCG 求解器属于迭代求解器，内存占用远小于稀疏求解器，适合大型模型。但它的收敛性与矩阵条件数有关，对某些问题可能不收敛或收敛缓慢。PCG 的精度控制通过 EQSLV,PCG,,1e-8 设置容差：

~~~apdl
EQSLV,PCG,,1e-8        ! PCG求解器，容差1e-8
~~~

选择建议：小型模型（<10万自由度）使用稀疏求解器；大型模型优先尝试 PCG；如果 PCG 不收敛再回到稀疏求解器并增加内存。

## 求解控制参数

SOLCONTROL 提供一键式非线性求解设置。NCNV 控制发散时的行为，NEQIT 控制最大迭代次数：

~~~apdl
! 智能求解控制
SOLCONTROL,ON          ! 开启 (推荐)
SOLCONTROL,OFF         ! 关闭 (使用手动设置)

! 收敛控制
NCNV,2                 ! 不收敛时继续到下一个载荷步 (而非终止)
NCNV,1                 ! 不收敛时终止求解 (默认)

! 迭代次数控制
NEQIT,25               ! 每个子步最大迭代次数25 (默认15)
NEQIT,50               ! 增加到50 (难收敛问题时)

! 收敛准则 (默认使用力和力矩的L2范数)
CNVTOL,F,,0.005        ! 力收敛容差0.5%
CNVTOL,U,,0.01         ! 位移收敛容差1%
~~~

对于包含接触的非线性分析，可能需要更多的子步和迭代次数：

~~~apdl
SOLCONTROL,ON
NSUBST,20,200,10       ! 初始20步，最多200步，最少10步
NEQIT,30               ! 每步最多30次迭代
NCNV,2                 ! 不收敛继续
~~~

## SOLVE 命令与求解监控

SOLVE 命令启动求解过程。求解前可以通过 /STAT 查看当前设置，通过 OUTPR 控制输出到窗口的信息：

~~~apdl
! 求解前检查设置
/STAT,SOLU             ! 查看当前求解设置摘要

! 控制输出信息
OUTPR,ALL,LAST         ! 输出最后子步的基本信息
OUTPR,ALL,ALL          ! 输出所有子步信息 (调试用)
OUTPR,NSOL,5           ! 每5个子步输出节点解
OUTPR,V,1              ! 每个子步输出详细迭代信息

! 开始求解
SOLVE
~~~

求解过程中，ANSYS 在输出窗口显示收敛信息。对于非线性分析，会显示每个子步的迭代次数、收敛值和残差。如果求解不收敛，常见原因包括：约束不足（刚体运动）、材料参数不合理、载荷过大和网格质量差。

## 多分析类型串联

一个完整的分析流程可能包含多种分析类型。例如先做静力分析，再做预应力模态分析：

~~~apdl
! ===== 第一步：静力分析 =====
/SOLU
ANTYPE,STATIC
D,1,ALL,0
ACEL,0,9.81,0
F,100,FY,-10000
NSUBST,5
OUTRES,ALL,LAST
SOLVE
FINISH

! ===== 第二步：预应力模态分析 =====
/SOLU
ANTYPE,MODAL
MODOPT,LANB,10
MXPAND,10
PSTRES,ON              ! 开启预应力效应
! 约束保持不变，载荷不需要重新施加
SOLVE
FINISH
~~~

预应力模态分析考虑了静力载荷引起的应力刚度效应，例如拉紧的弦比松弛的弦固有频率更高。

## 求解结果读取

求解完成后进入后处理读取结果。SET 命令用于选择要读取的结果集：

~~~apdl
/POST1
SET,LAST               ! 读取最后一个载荷步的结果
SET,FIRST              ! 读取第一个载荷步的结果
SET,2                  ! 读取载荷步2的结果
SET,1,3                ! 读取载荷步1子步3的结果
SET,LIST               ! 列出所有可用的结果集
~~~

## 本节要点

ANTYPE 设置分析类型：STATIC 静力、MODAL 模态、HARMIC 谐响应、TRANS 瞬态、BUCKLE 屈曲。模态分析使用 MODOPT 选择提取方法，LANB 适合大多数情况。EQSLV 选择求解器：SPARSE 稳健但内存大，PCG 省内存适合大型模型。SOLCONTROL,ON 自动设置合理的非线性参数。NCNV 控制发散行为，NEQIT 控制最大迭代次数。SOLVE 启动求解，/STAT,SOLU 可在求解前检查设置。多个分析类型可以串联，通过 PSTRES,ON 考虑预应力效应。
`,

  'apdl-post1': String.raw`
通用后处理器 POST1 用于查看和分析有限元求解结果。它支持云图显示、变形图、结果列表、路径操作和动画等多种结果展示方式。掌握 POST1 的各项功能是验证分析结果和提取工程数据的关键步骤。

## 进入后处理与读取结果

求解完成后，使用 /POST1 进入通用后处理器。SET 命令用于选择要查看的结果集，每个载荷步和子步对应一个结果集：

~~~apdl
FINISH
/POST1                 ! 进入通用后处理器

! 读取结果
SET,LAST               ! 读取最后载荷步最后子步的结果
SET,FIRST              ! 读取第一个结果集
SET,NEXT               ! 读取下一个结果集
SET,PREV               ! 读取上一个结果集

! 按载荷步和子步号读取
SET,2,3                ! 载荷步2，子步3

! 按时间值读取
SET,,1.5               ! 时间=1.5对应的结果

! 查看所有可用结果集
SET,LIST
~~~

~~~text
  SET   TIME/FREQ    LOAD STEP   SUBSTEP   CUMULATIVE
    1    1.0000          1           5          1
    2    2.0000          2           3          2
    3    3.0000          3          10          3
~~~

## 位移云图与变形图

PLDISP 显示变形图，PLNSOL 显示节点结果的云图。变形图是理解结构行为最直观的方式之一：

~~~apdl
/POST1
SET,LAST

! 变形图
PLDISP,0              ! 只显示变形后形状
PLDISP,1              ! 显示变形后+未变形轮廓
PLDISP,2              ! 显示变形后+未变形轮廓(带边界)

! 位移云图 (节点平均)
PLNSOL,U,X            ! X方向位移云图
PLNSOL,U,Y            ! Y方向位移云图
PLNSOL,U,Z            ! Z方向位移云图
PLNSOL,U,SUM          ! 总位移云图 (合成位移)

! 变形动画
ANDATA,1,PLDISP,1     ! 对变形图做动画
~~~

PLNSOL 对节点结果进行平均处理，显示平滑的云图。PLESOL 则显示未平均的单元结果，可以看到单元间的不连续性，用于判断网格是否足够密：

~~~apdl
! 单元结果 (未平均, 可以看到单元间差异)
PLESOL,S,X            ! X方向正应力
PLESOL,S,Y            ! Y方向正应力
PLESOL,S,Z            ! Z方向正应力
PLESOL,S,1            ! 第一主应力
PLESOL,S,2            ! 第二主应力
PLESOL,S,3            ! 第三主应力
PLESOL,S,EQV          ! von Mises等效应力
~~~

## 应力云图

应力是结构分析中最常查看的结果。S,EQV 即 von Mises 等效应力，是判断材料是否屈服的主要依据：

~~~apdl
/POST1
SET,LAST

! von Mises应力云图
PLNSOL,S,EQV          ! 节点平均的等效应力

! 主应力
PLNSOL,S,1            ! 第一主应力 (最大)
PLNSOL,S,3            ! 第三主应力 (最小)

! 剪应力
PLNSOL,S,XY           ! XY面剪应力

! 调整显示范围
/CONTOUR,,10,0,1e8    ! 10条等高线，范围0到100MPa
/CONTOUR,,AUTO        ! 恢复自动范围
~~~

对于壳单元，可以分别查看顶面、中面和底面的应力：

~~~apdl
SHELL,TOP             ! 查看壳顶面应力
PLNSOL,S,EQV

SHELL,BOT             ! 查看壳底面应力
PLNSOL,S,EQV

SHELL,MID             ! 查看壳中面应力
PLNSOL,S,EQV
~~~

## 结果查询与列表

PRNSOL 将节点结果打印到输出窗口，PRESOL 打印单元结果。*GET 命令可以将结果值提取到参数中供后续计算：

~~~apdl
! 打印节点结果
PRNSOL,U               ! 打印所有节点位移
PRNSOL,S               ! 打印所有节点应力

! 打印特定区域的结果
NSEL,S,LOC,X,0.5      ! 选择X=0.5处的节点
PRNSOL,U               ! 只打印选中节点的位移
PRNSOL,S,EQV           ! 只打印选中节点的等效应力
ALLSEL

! 打印单元结果
ESEL,S,MAT,,1         ! 选择材料1的单元
PRESOL,S               ! 打印选中单元的应力
ALLSEL

! 使用*GET提取特定值
*GET,max_disp,NODE,,MNLOC,U,SUM  ! 获取最大总位移的节点号
*GET,disp_val,NODE,max_disp,U,SUM  ! 获取该节点的位移值
*GET,max_stress,NODE,,MNMX,S,EQV  ! 获取最大等效应力
~~~

*GET 命令将结果存入参数后，可以用参数进行进一步计算或判断：

~~~apdl
*GET,max_vm,NODE,,MNMX,S,EQV
allowable = 2.35e8       ! 许用应力235MPa
safety = allowable / max_vm

*IF,safety,LT,1.0,THEN
  *MSG,WARNING
  安全系数 %s 小于1.0，结构可能不安全！
  %ARG1%
  safety
*ENDIF
~~~

## 单元表 ETABLE

ETABLE 允许用户从单元结果中提取特定数据项，存储为"列"，然后进行数学运算。它特别适合处理梁单元截面力和壳单元层间应力：

~~~apdl
/POST1
SET,LAST

! 梁单元截面力
ETABLE,AXFORCE,SMISC,1     ! 轴力
ETABLE,SHEARY,SMISC,2      ! Y方向剪力
ETABLE,MOMZ,SMISC,6        ! Z方向弯矩

! 绘制梁内力图
PLLS,AXFORCE,AXFORCE       ! 轴力图
PLLS,SHEARY,SHEARY         ! 剪力图
PLLS,MOMZ,MOMZ             ! 弯矩图

! 打印内力
PRRSOL                     ! 打印支反力
PRETAB,AXFORCE,SHEARY,MOMZ ! 打印单元表

! 实体单元体积
ETABLE,EVOL,VOLU           ! 单元体积
SSUM                        ! 求和得到总体积
~~~

删除不需要的单元表项：

~~~apdl
ETABLE,ERASE               ! 删除所有单元表项
ETABLE,REFL                ! 重新填充单元表 (载荷步改变后)
~~~

## 路径操作

路径操作用于沿用户定义的路径提取和显示结果，是评估应力梯度、应力集中和断裂力学参数的重要工具：

~~~apdl
/POST1
SET,LAST

! 定义路径
PATH,my_path,2,30,20       ! 路径名，2个点，30个插值点，20个结果集
PPATH,1,,0,0,0             ! 起点 (0,0,0)
PPATH,2,,0.2,0,0           ! 终点 (0.2,0,0)

! 在路径上映射结果
PDEF,SX,S,X                ! 映射X方向正应力
PDEF,SEQV,S,EQV            ! 映射等效应力
PDEF,U_X,U,X               ! 映射X方向位移

! 沿路径绘制结果
PLPATH,SX,SEQV              ! 绘制SX和SEQV沿路径的变化
PRPATH,SX                   ! 打印SX沿路径的数值

! 另一个路径示例：穿过厚度方向
PATH,thru_thick,2,50,20
PPATH,1,,0.1,0,-0.005      ! 底面
PPATH,2,,0.1,0,0.005       ! 顶面

PDEF,SX,S,X
PDEF,SY,S,Y
PLPATH,SX,SY                ! 绘制厚度方向应力分布
~~~

路径操作的结果可以导出到文件，用于报告或进一步分析：

~~~apdl
PARES,my_path              ! 恢复路径定义
PRPATH,SX,SEQV              ! 打印路径上的结果值
~~~

## 支反力查看

支反力是验证模型平衡的重要指标。PRRSOL 打印所有约束节点的反力：

~~~apdl
/POST1
SET,LAST

! 打印支反力
PRRSOL                     ! 打印所有反力和反力矩
PRRSOL,F                   ! 只打印反力
PRRSOL,M                   ! 只打印反力矩

! 对反力求和 (检查平衡)
FSUM                        ! 对所有选中节点反力求和
~~~

~~~text
  PRINT REACTION SOLUTIONS PER NODE
  NODE       FX          FY          FZ
     1    5000.0     12345.6       0.0
     2   -5000.0    -12345.6       0.0
  TOTAL  =    0.0         0.0       0.0
~~~

反力总和应为零（或与施加的外力平衡），若不平衡说明模型存在问题。

## 结果动画

ANDATA 命令可以生成结果动画，直观展示载荷作用过程：

~~~apdl
! 变形动画
ANDATA,1,PLDISP,1          ! 从0到满变形做动画

! 应力动画
ANDATA,1,PLNSOL,S,EQV      ! 应力变化动画

! 多帧动画控制
/ANFILE,SAVE,animation,avi  ! 保存动画到文件
ANDATA,1,PLNSOL,U,SUM       ! 位移动画
~~~

## 实战：完整的后处理流程

以下是对一个静力分析结果进行完整后处理的示例：

~~~apdl
/POST1
SET,LAST                  ! 读取最后结果

! 1. 查看整体变形
PLDISP,1                  ! 变形图（含未变形轮廓）

! 2. 查看位移
PLNSOL,U,SUM              ! 总位移云图
*GET,max_u,NODE,,MNMX,U,SUM
*GET,max_node,NODE,,MNLOC,U,SUM
*MSG,INFO
最大位移 = %G m, 位于节点 %I
%ARG1%
%ARG2%
max_u
max_node

! 3. 查看应力
PLNSOL,S,EQV              ! von Mises应力云图
*GET,max_vm,NODE,,MNMX,S,EQV
*MSG,INFO
最大von Mises应力 = %G Pa
%ARG1%
max_vm

! 4. 查看支反力
PRRSOL
FSUM

! 5. 定义路径查看应力分布
PATH,stress_line,2,50,20
PPATH,1,,0,0,0
PPATH,2,,0.5,0,0
PDEF,SEQV,S,EQV
PDEF,SX,S,X
PLPATH,SEQV,SX            ! 绘制沿路径的应力变化

! 6. 单元表查看梁内力
ETABLE,AXIAL,SMISC,1
ETABLE,MOM_Z,SMISC,6
PLLS,AXIAL,AXIAL           ! 轴力图
PLLS,MOM_Z,MOM_Z           ! 弯矩图
PRETAB,AXIAL,MOM_Z         ! 打印内力表
~~~

## 本节要点

/POST1 进入通用后处理器，SET 命令选择要查看的结果集。PLDISP 显示变形图，PLNSOL 显示节点平均云图（平滑），PLESOL 显示单元未平均云图（可检查网格密度）。S,EQV 为 von Mises 等效应力，是屈服判断的主要依据。PRNSOL 和 PRESOL 打印结果到输出窗口，*GET 提取结果到参数。ETABLE 处理梁截面力和壳层间应力。PATH/PPATH/PDEF/PLPATH 沿路径提取结果。PRRSOL 查看支反力，FSUM 验证力的平衡。ANDATA 生成结果动画。
`,
} as const;
