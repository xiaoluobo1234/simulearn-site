export const apdlPostAdvancedTutorials = {
  'apdl-post26': String.raw`
时间历程后处理器 POST26 用于观察模型中某些点在分析过程中随时间（或频率、载荷步等自变量）变化的结果。与通用后处理器 POST1 不同，POST1 只能查看某一时刻的全场数据，而 POST26 可以绘制某个节点位移、应力、反力等量随时间变化的曲线，非常适合瞬态分析、谐响应分析和谱分析的结果处理。

## 进入 POST26

在求解完成后，使用 \`/POST26\` 命令进入时间历程后处理器。进入后系统会自动创建一个变量存储区域，自变量（通常是时间 TIME）默认编号为变量 1。

~~~apdl
FINISH
/POST26
~~~

进入 POST26 后，可以用 \`/AXLAB\` 设置坐标轴标签，用 \`/XRA\` 和 \`/YRA\` 设置坐标轴范围，这些命令与 POST1 中的图形设置类似。

## 定义变量

POST26 的核心概念是"变量"。每个变量对应一条曲线，变量编号从 2 开始（编号 1 留给自变量 TIME）。定义变量的常用命令包括：

**NSOL — 节点结果变量**

\`NSOL\` 用于提取某个节点的自由度结果或节点应力/应变等结果：

~~~apdl
! 定义变量 2：节点 100 的 Y 方向位移
NSOL,2,100,U,Y,UY_Node100

! 定义变量 3：节点 100 的 X 方向位移
NSOL,3,100,U,X,UX_Node100
~~~

参数说明：第一个参数是变量编号，第二个是节点编号，后面是结果项目（U 表示位移，S 表示应力等），再后面是分量方向，最后是用户自定义的变量名称标签。

**ESOL — 单元结果变量**

\`ESOL\` 提取单元级别的结果，例如单元应力、应变或内力：

~~~apdl
! 定义变量 4：单元 50 的 X 方向正应力（在积分点处）
ESOL,4,50,,S,X,SX_Elem50

! 定义变量 5：单元 50 的 von Mises 等效应力
ESOL,5,50,,S,EQV,SEQV_Elem50
~~~

**RFORCE — 反力变量**

\`RFORCE\` 用于提取节点反力（约束处的支反力）：

~~~apdl
! 定义变量 6：节点 1 的 Y 方向反力
RFORCE,6,1,F,Y,FY_Node1
~~~

反力变量在验证平衡条件时非常有用。例如悬臂梁固定端的反力应该与施加的外载荷大小相等、方向相反。

## 变量运算

定义好基本变量后，POST26 提供了丰富的数学运算命令对变量进行二次处理：

**ADD — 变量相加**

~~~apdl
! 变量 7 = 变量 2 + 变量 3（两个位移分量之和）
ADD,7,2,3,,SumDisp
~~~

**PROD — 变量相乘**

~~~apdl
! 变量 8 = 变量 4 x 变量 5
PROD,8,4,5,,Product
~~~

**ABS — 取绝对值**

~~~apdl
! 变量 9 = |变量 2|（位移的绝对值）
ABS,9,2,,,AbsDisp
~~~

**SQRT — 取平方根**

~~~apdl
! 变量 10 = 变量 2 的平方根
SQRT,10,2
~~~

此外还有 \`LARGE\`（取较大值）、\`SMALL\`（取较小值）、\`EXP\`（指数）和 \`LOG\`（对数）等运算。这些运算命令使得 POST26 能够灵活地进行结果后处理，例如将两个方向的位移合成总位移。

## 绘制变量曲线

使用 \`PLVAR\` 命令绘制变量随自变量变化的曲线：

~~~apdl
! 绘制变量 2（节点 100 的 Y 方向位移）
PLVAR,2

! 同时绘制多条曲线
PLVAR,2,3,6
~~~

绘图前可以设置图形参数：

~~~apdl
! 设置 X 轴标签和范围
/AXLAB,X,Time (s)
/AXLAB,Y,Displacement (m)
/XRAN,0,10

! 设置 Y 轴范围
/YRAN,-0.01,0.01

! 设置图形标题
/TITLE,Node 100 Y-Displacement vs Time
~~~

使用 \`PLTIME\` 可以限制绘图的时间范围，只显示某段时间内的结果：

~~~apdl
! 只绘制 2 秒到 8 秒之间的数据
PLTIME,2,8
PLVAR,2
~~~

## 列表输出变量

\`PRVAR\` 将变量数据以文本形式输出到窗口或文件：

~~~apdl
! 打印变量 2 的数据
PRVAR,2

! 同时打印多个变量
PRVAR,2,3,6
~~~

输出格式包含自变量（时间）和各变量的对应值，便于查看具体数值或导出数据做进一步处理。

## 导数与积分运算

POST26 可以对变量进行微分和积分运算，这在振动分析中特别有用：

**DERIV — 求导数**

~~~apdl
! 变量 11 = d(变量2)/d(变量1)，即位移对时间的导数（速度）
DERIV,11,2,1,Velocity
~~~

对速度再求导即可得到加速度。导数运算在瞬态分析中可以从位移结果推算速度和加速度，无需重新求解。

**INT1 — 求积分**

~~~apdl
! 变量 12 = 变量 2 对变量 1 的积分
INT1,12,2,1,Integral_Disp
~~~

积分运算可用于计算能量、累积量等物理量。例如对功率信号积分可以得到能量。

## 查看变量状态与导出数据

**查看变量状态**

\`*STATUS\` 命令可以显示当前已定义的所有变量及其属性：

~~~apdl
*STATUS
~~~

也可以使用 \`VGET\` 将变量数据读入 APDL 数组参数，以便进一步处理：

~~~apdl
! 定义数组并读取变量数据
*DIM,timeArr,ARRAY,100
*DIM,dispArr,ARRAY,100
VGET,timeArr(1),1
VGET,dispArr(1),2
~~~

**导出数据到文件**

通过 \`/OUTPUT\` 命令重定向输出，可以将 \`PRVAR\` 的结果写入文本文件：

~~~apdl
! 将输出重定向到文件
/OUTPUT,result_data,txt

! 打印变量数据（将写入文件而非屏幕）
PRVAR,2,3

! 恢复屏幕输出
/OUTPUT
~~~

导出的文本文件可以用 Excel、Python 或 MATLAB 进一步处理和绘图。

## 实际案例：瞬态分析中绘制位移-时间曲线

以下是一个完整的 POST26 应用示例。假设已完成一个悬臂梁的瞬态动力学分析，梁的长度为 1 m，截面为 50 mm x 100 mm，在自由端施加了随时间变化的集中力，现在需要观察自由端节点的位移响应。

~~~apdl
! =============================================
! POST26 时间历程后处理示例
! 前提：已完成瞬态分析，结果文件存在
! =============================================
FINISH
/POST26

! 设置自变量（时间）范围
/XRAN,0,2

! 定义变量：自由端节点（假设编号 201）的位移
NSOL,2,201,U,Y,UY_Tip       ! Y 方向位移
NSOL,3,201,U,X,UX_Tip       ! X 方向位移

! 定义变量：固定端节点（假设编号 1）的反力
RFORCE,4,1,F,Y,FY_Fixed     ! Y 方向反力

! 计算速度（位移对时间的导数）
DERIV,5,2,1,Velocity_Y      ! Y 方向速度

! 计算加速度（速度对时间的导数）
DERIV,6,5,1,Accel_Y         ! Y 方向加速度

! 设置图形标题和轴标签
/TITLE,Tip Displacement vs Time
/AXLAB,X,Time (s)
/AXLAB,Y,Displacement (m)

! 绘制位移曲线
PLVAR,2

! 绘制速度曲线
/TITLE,Tip Velocity vs Time
/AXLAB,Y,Velocity (m/s)
PLVAR,5

! 将位移数据导出到文件
/OUTPUT,tip_disp,txt
PRVAR,2,3
/OUTPUT

! 查看变量列表
*STATUS
~~~

运行上述代码后，图形窗口将依次显示位移和速度随时间变化的曲线，同时位移数据已保存到 \`tip_disp.txt\` 文件中。通过 \`PRVAR\` 还可以在输出窗口中查看各时间点对应的具体数值，便于与手算结果或实验数据进行对比验证。

## 本节要点

POST26 是 ANSYS 时间历程后处理器，专门用于查看结果随自变量（时间、频率等）变化的曲线。核心流程为：进入 \`/POST26\` -> 用 \`NSOL\`、\`ESOL\`、\`RFORCE\` 定义变量 -> 用 \`ADD\`、\`PROD\`、\`DERIV\`、\`INT1\` 进行变量运算 -> 用 \`PLVAR\` 绘图或 \`PRVAR\` 列表输出。变量编号 1 保留给自变量，用户定义的变量从编号 2 开始。导出数据时使用 \`/OUTPUT\` 重定向配合 \`PRVAR\` 即可生成文本文件，便于后续用其他工具进一步分析。

> 📝 **相关练习**：[ex-apdl-post26-01] 提取时程曲线并导出数据
`,

  'apdl-selection': String.raw`
在 ANSYS APDL 中，选择操作是最基础也最重要的技能之一。当模型包含成百上千个节点和单元时，不可能逐一指定操作对象，必须通过选择命令按照位置、属性或结果数据筛选出需要的实体子集。选择操作贯穿建模、加载、求解和后处理的每个环节，理解选择机制是高效使用 APDL 的前提。

## 选择命令概览

ANSYS 提供了针对不同实体类型的选择命令，每种实体对应一个专用命令：

| 命令 | 选择对象 | 全称 |
|------|----------|------|
| \`NSEL\` | 节点 | Node Select |
| \`ESEL\` | 单元 | Element Select |
| \`KSEL\` | 关键点 | Keypoint Select |
| \`LSEL\` | 线 | Line Select |
| \`ASEL\` | 面 | Area Select |
| \`VSEL\` | 体 | Volume Select |

这些命令的参数格式高度一致，掌握其中一个后，其余命令的学习成本很低。

## 选择动作

所有选择命令的第一个参数都是"动作"，决定本次选择如何影响当前已选集合：

- **S**（Select）：从全部实体中选出满足条件的子集，取代当前选择。这是最常用的动作，相当于"重新选择"。
- **R**（Reselect）：从当前已选实体中进一步筛选。相当于"在当前选择范围内再选"。
- **A**（Also select）：将满足条件的实体添加到当前选择中，不取消已有的选择。相当于"追加选择"。
- **U**（Unselect）：从当前选择中移除满足条件的实体。相当于"取消部分选择"。
- **ALL**（Select All）：重新选择全部实体，恢复到无选择状态。

理解这些动作的区别非常重要。例如，先用 \`S\` 选出某一区域的节点，再用 \`R\` 从中筛选出特定材料上的节点，最后用 \`U\` 排除掉某些不需要的节点——这种组合操作在实际工程中非常常见。

## 按位置选择节点

\`NSEL\` 的常用格式为 \`NSEL,Action,LOC,Direction,Vmin,Vmax\`：

~~~apdl
! 选择 X 坐标等于 0 的所有节点
NSEL,S,LOC,X,0

! 选择 Y 坐标在 0.5 到 1.0 之间的所有节点
NSEL,S,LOC,Y,0.5,1.0

! 选择 Z 坐标等于 0 的节点（底面节点）
NSEL,S,LOC,Z,0

! 在当前选择基础上，追加 X 坐标等于 1.0 的节点
NSEL,A,LOC,X,1.0
~~~

方向参数可以是 X、Y、Z，也可以是 R（径向）、THETA（角度）等柱坐标或球坐标方向（需先切换到对应坐标系）。

## 按位置选择关键点、线、面、体

位置选择的语法对所有实体类型通用：

~~~apdl
! 选择 X=0 处的所有关键点
KSEL,S,LOC,X,0

! 选择 Y 坐标在 0 到 0.5 之间的所有线
LSEL,S,LOC,Y,0,0.5

! 选择 Z=0 平面上的所有面
ASEL,S,LOC,Z,0

! 选择全部体
VSEL,ALL
~~~

## 按属性选择

除了位置，还可以按照材料号、单元类型号、实常数号等属性进行选择：

~~~apdl
! 选择材料号为 2 的所有单元
ESEL,S,MAT,,2

! 选择单元类型号为 1 的所有单元
ESEL,S,TYPE,,1

! 选择实常数号为 3 的所有单元
ESEL,S,REAL,,3

! 选择材料号为 1 的所有节点（通过附着关系）
! 注意：NSEL 不直接支持 MAT，需先选单元再选节点
ESEL,S,MAT,,1
NSLE,S       ! 选择已选单元上的所有节点
~~~

按属性选择在多材料模型中非常实用。例如一个由钢和铝组成的结构，可以先选钢材料的单元查看应力，再选铝材料的单元查看应力。

## 选择附着实体

ANSYS 提供了快捷命令，根据实体之间的拓扑关系进行选择：

~~~apdl
! 选择所有已选面上的节点
NSLA,S,ALL    ! S 表示选择，ALL 表示包括面内部节点

! 选择所有已选线上的节点
NSLL,S,1      ! 1 表示只选线端点处的节点

! 选择所有已选面上的单元
ESLA,S

! 选择所有已选单元上的节点
NSLE,S

! 选择所有已选节点上的单元
ENSL,S
~~~

这些"附着选择"命令在加载时特别常用。例如要在某个面上施加压力，可以先选面，再选面上的单元，然后施加面载荷。

## 创建与使用组件

组件（Component）是给一组实体起的命名集合，可以反复调用而不必每次重新选择。

**CM — 创建组件**

~~~apdl
! 选择底面节点并创建组件
NSEL,S,LOC,Y,0
CM,FIX_NODES,NODE    ! 创建节点组件 FIX_NODES

! 选择加载面上的单元并创建组件
ASEL,S,LOC,Z,0.5
ESLA,S
CM,LOAD_ELEMS,ELEM   ! 创建单元组件 LOAD_ELEMS

! 选择加载面的关键点并创建组件
KSEL,S,LOC,X,0
CM,LEFT_KPS,KP       ! 创建关键点组件 LEFT_KPS
~~~

\`CM\` 的第一个参数是组件名称（最多 32 个字符），第二个参数是实体类型（NODE、ELEM、KP、LINE、AREA、VOLU）。

**CMSEL — 选择组件**

~~~apdl
! 选择组件 FIX_NODES 中的所有节点
CMSEL,S,FIX_NODES

! 在当前选择基础上追加组件
CMSEL,A,LOAD_ELEMS
~~~

**CMLIST — 列出所有组件**

~~~apdl
CMLIST,ALL    ! 列出全部组件
~~~

组件的优势在于：一次创建、反复使用。在复杂模型中，加载面、约束面、接触面等区域需要多次引用，用组件可以大幅提高代码可读性和维护性。

## 恢复全选

\`ALLSEL\` 命令恢复选择全部实体，它等价于对所有实体类型执行 \`XXSEL,ALL\`：

~~~apdl
ALLSEL,ALL    ! 选择所有类型的所有实体

! 等价于：
NSEL,ALL
ESEL,ALL
KSEL,ALL
LSEL,ALL
ASEL,ALL
VSEL,ALL
~~~

在切换到下一个处理器或开始新操作之前，务必执行 \`ALLSEL,ALL\`，否则遗漏的未选实体可能导致意外行为。

## 实际案例：在面上选择节点并施加温度载荷

以下是一个典型的选择操作应用场景。假设有一个长方体模型，需要在顶面施加温度载荷，在底面施加固定约束。

~~~apdl
! =============================================
! 选择操作综合示例
! 模型：1m x 0.5m x 0.2m 的长方体
! =============================================

! 第一步：选择底面节点并创建约束组件
NSEL,S,LOC,Y,0           ! 选择 Y=0 处的节点
CM,BOTTOM_NODES,NODE     ! 创建组件
ALLSEL,ALL               ! 恢复全选

! 第二步：选择顶面节点并创建载荷组件
NSEL,S,LOC,Y,0.5         ! 选择 Y=0.5 处的节点
CM,TOP_NODES,NODE        ! 创建组件
ALLSEL,ALL               ! 恢复全选

! 第三步：选择钢材料（MAT=1）的单元
ESEL,S,MAT,,1            ! 按材料号选择
CM,STEEL_ELEMS,ELEM      ! 创建组件
ALLSEL,ALL               ! 恢复全选

! 第四步：在底面施加约束
CMSEL,S,BOTTOM_NODES     ! 选择底面节点组件
D,ALL,ALL,0              ! 固定所有自由度
ALLSEL,ALL               ! 恢复全选

! 第五步：在顶面施加温度载荷
CMSEL,S,TOP_NODES        ! 选择顶面节点组件
BF,ALL,TEMP,100          ! 施加温度
ALLSEL,ALL               ! 恢复全选

! 第六步：查看钢材料单元的应力结果
! （假设已完成求解）
! CMSEL,S,STEEL_ELEMS    ! 选择钢材料单元
! /POST1
! PLNSOL,S,EQV           ! 绘制等效应力（只显示钢部分）
! ALLSEL,ALL
~~~

在这个示例中，组件被多次创建和引用。如果不使用组件，每次操作都需要重新按位置选择节点，代码冗余且容易出错。

## 选择操作中的常见陷阱

第一，选择是"有状态"的。每次 \`S\` 动作都会替换当前选择，如果忘记先 \`ALLSEL\`，后续选择可能基于一个不完整的集合。

第二，\`R\` 动作是从当前选择中再选。如果当前选择为空，\`R\` 的结果也是空集。使用 \`R\` 之前要确认当前选择确实包含目标实体。

第三，图形显示只反映当前选择。如果模型"消失"了一部分，很可能是某些实体被意外取消选择了，执行 \`ALLSEL,ALL\` 即可恢复。

第四，后处理绘图和列表输出只针对当前选择的实体。如果发现结果图中缺少某些区域的数据，先检查选择状态。

## 本节要点

选择操作是 APDL 的核心技能之一。\`NSEL\`、\`ESEL\`、\`KSEL\`、\`LSEL\`、\`ASEL\`、\`VSEL\` 分别针对不同实体类型；动作参数 S/R/A/U/ALL 控制选择行为；\`NSLA\`、\`ESLA\`、\`NSLE\` 等命令利用拓扑关系快速选择附着实体；\`CM\` 创建命名组件便于反复引用；\`CMSEL\` 调用组件；每次操作完毕后务必执行 \`ALLSEL,ALL\` 恢复全选状态，避免后续操作受到意外影响。

> 📝 **相关练习**：[ex-apdl-select-01] 使用组件简化加载
`,

  'apdl-parameters': String.raw`
APDL 参数是为数值或字符串起的名字，可以在命令中代替硬编码的值使用。参数使得脚本具有灵活性和可复用性——修改参数值就能改变模型尺寸、材料属性或载荷大小，无需逐行修改命令。参数化建模是 APDL 区别于手工 GUI 操作的核心优势之一。

## 参数定义与命名规则

参数通过赋值语句定义，格式为 \`参数名 = 值\`：

~~~apdl
! 定义数值参数
width = 0.05          ! 宽度 50 mm（以米为单位）
height = 0.1          ! 高度 100 mm
length = 1.0          ! 长度 1 m
force = 10000         ! 集中力 10 kN
pressure = 5e6        ! 压力 5 MPa
youngs_mod = 2.1e11   ! 弹性模量 210 GPa
poisson = 0.3         ! 泊松比
density = 7850        ! 密度 kg/m³

! 定义字符串参数（用单引号包围）
mat_name = 'STEEL'
elem_type = 'SOLID185'
~~~

参数命名规则：名称长度不超过 32 个字符；必须以字母开头；只能包含字母、数字和下划线；不能使用 APDL 保留名称（以单下划线 \`_\` 开头的通常是系统参数）；参数名不区分大小写（\`Width\` 和 \`width\` 是同一个参数）。

## 标量参数与算术运算

参数可以参与算术运算，运算符包括：\`+\`（加法）、\`-\`（减法）、\`*\`（乘法）、\`/\`（除法）、\`**\`（幂运算）。

~~~apdl
! 参数运算示例
width = 0.05
height = 0.1
area = width * height              ! 截面积
inertia = width * height**3 / 12   ! 惯性矩 I = bh^3/12
diag = (width**2 + height**2)**0.5 ! 对角线长度

! 在命令中直接使用参数
K,1,0,0,0              ! 关键点 1 在原点
K,2,length,0,0          ! 关键点 2 在 (length, 0, 0)
K,3,length,height,0     ! 关键点 3 在 (length, height, 0)
K,4,0,height,0          ! 关键点 4 在 (0, height, 0)
~~~

运算遵循标准数学优先级：幂运算最高，然后乘除，最后加减。使用括号可以改变优先级。

## 比较运算符

APDL 使用缩写形式的比较运算符，主要用于条件判断语句 \`*IF\` 中：\`EQ\`（等于）、\`NE\`（不等于）、\`LT\`（小于）、\`GT\`（大于）、\`LE\`（小于等于）、\`GE\`（大于等于）。

~~~apdl
max_stress = 250e6
allow_stress = 300e6

*IF,max_stress,LT,allow_stress,THEN
  *MSG,'应力满足要求'
*ELSE
  *MSG,'警告：应力超限！'
*ENDIF
~~~

## *GET 命令——从数据库获取信息

\`*GET\` 是 APDL 最强大的命令之一，它能从 ANSYS 数据库中提取几乎任何信息并赋给参数。语法格式为：\`*GET, Par, Entity, ENTNUM, Item1, IT1NUM, Item2, IT2NUM\`。其中 Par 是接收结果的参数名，Entity 是实体类型，ENTNUM 是实体编号，后续参数指定要提取的信息类型。

~~~apdl
! 获取关键点 1 的 X 坐标
*GET,kp1_x,KP,1,LOC,X

! 获取节点总数
*GET,nodeCount,NODE,,COUNT

! 获取单元总数
*GET,elemCount,ELEM,,COUNT

! 获取当前选择集中的节点数量
*GET,selNodeCount,NODE,,NSEL

! 获取节点 100 的 Y 方向位移（需要先求解并读入结果）
*GET,uy100,NODE,100,U,Y
~~~

**获取后处理结果**

\`*GET\` 在后处理中尤其有用，可以自动提取最大/最小值：

~~~apdl
/POST1
SET,LAST                    ! 读入最后一个载荷步的结果

! 获取最大 von Mises 应力
*GET,maxSeqv,PLNSOL,S,EQV,0,MAX

! 获取最小 von Mises 应力
*GET,minSeqv,PLNSOL,S,EQV,0,MIN

! 获取最大 Y 方向位移
*GET,maxUY,PLNSOL,U,Y,0,MAX

! 获取最大位移对应的节点编号
*GET,maxNode,PLNSOL,U,Y,0,MAX,LOC
~~~

这些自动提取的值可以用于后续判断、报告生成或优化迭代。

**获取模型几何信息**

~~~apdl
! 获取关键点 2 的 Y 坐标
*GET,kp2_y,KP,2,LOC,Y

! 获取线 1 的长度
*GET,len1,LINE,1,LENGTH

! 获取面 1 的面积
*GET,area1,AREA,1,AREA

! 获取体 1 的体积
*GET,vol1,VOLU,1,VOLU
~~~

## *VGET 命令——批量获取数组数据

当需要提取大量数据时，逐一使用 \`*GET\` 效率太低。\`*VGET\` 可以一次性将数据填充到数组参数中：

~~~apdl
! 定义数组（假设最多 1000 个节点）
*DIM,nodeUX,ARRAY,1000
*DIM,nodeUY,ARRAY,1000

! 批量获取所有节点的位移
*VGET,nodeUX(1),NODE,1,U,X
*VGET,nodeUY(1),NODE,1,U,Y
~~~

\`*VGET\` 的第一个数组元素指定起始位置，后面的参数含义与 \`*GET\` 类似。它会按照节点编号顺序自动填充数组。

## 参数替换

在命令中使用 \`%参数名%\` 的格式可以将参数值替换到字符串或命令参数中：

~~~apdl
n_subst = 20
NSUBST,%n_subst%          ! 等价于 NSUBST,20

! 在文件名中使用参数
run_id = 5
SAVE,run_%run_id%,db      ! 保存为 run_5.db
~~~

参数替换在生成系列文件名、循环操作中非常有用。

## 字符参数与字符串操作

字符参数用单引号定义，可以拼接和比较：

~~~apdl
base_name = 'beam'
suffix = '_v2'
full_name = base_name // suffix   ! 结果为 'beam_v2'

! 字符串比较
mat_type = 'STEEL'
*IF,mat_type,EQ,'STEEL',THEN
  MP,EX,1,2.1e11
  MP,PRXY,1,0.3
*ELSEIF,mat_type,EQ,'ALUM',THEN
  MP,EX,1,7.0e10
  MP,PRXY,1,0.33
*ENDIF
~~~

字符串连接使用 \`//\` 运算符。这在批量生成文件名和标签时非常方便。

## 系统参数

APDL 预定义了一些系统参数，以单下划线开头：\`_RETURN\`（上一个命令的返回值）、\`_STATUS\`（上一个命令的状态，0 表示成功）、\`_NWARN\`（累计警告数）、\`_NERR\`（累计错误数）。

~~~apdl
! 检查是否有错误
*IF,_NERR,GT,0,THEN
  *MSG,'检测到 %_NERR% 个错误，请检查输入'
*ENDIF
~~~

这些系统参数可以用于脚本的自动校验和错误处理。

## 实际案例：参数化悬臂梁

以下是一个完整的参数化建模示例。梁的宽度、高度、长度、载荷和材料属性全部由参数控制，修改参数即可改变整个模型。

~~~apdl
! =============================================
! 参数化悬臂梁建模与求解
! =============================================

! --- 参数定义 ---
b = 0.05                 ! 截面宽度 50 mm
h = 0.1                  ! 截面高度 100 mm
L = 1.0                  ! 梁长度 1 m
q = 10000                ! 均布载荷 10 kN/m
E_mod = 2.1e11           ! 弹性模量 210 GPa
nu = 0.3                 ! 泊松比
rho = 7850               ! 密度 kg/m³

! --- 派生参数 ---
A_sec = b * h            ! 截面积
I_sec = b * h**3 / 12    ! 截面惯性矩

! --- 理论值（用于验证） ---
delta_theory = q * L**4 / (8 * E_mod * I_sec)

! --- 前处理 ---
/PREP7
ET,1,BEAM188
MP,EX,1,E_mod
MP,PRXY,1,nu
MP,DENS,1,rho

SECTYPE,1,BEAM,RECT
SECDATA,b,h

K,1,0,0,0
K,2,L,0,0
L,1,2

LESIZE,ALL,,,20
LMESH,ALL

! --- 求解 ---
/SOLU
ANTYPE,STATIC
DK,1,ALL,0
SFBEAM,ALL,1,PRES,q
SOLVE
FINISH

! --- 后处理 ---
/POST1
SET,LAST
*GET,max_defl,PLNSOL,U,Y,0,MIN

*MSG,'理论最大挠度 = %delta_theory% m'
*MSG,'有限元最大挠度 = %max_defl% m'
~~~

通过这个例子可以看到，所有几何尺寸和材料属性都由参数控制。如果需要研究不同截面尺寸对挠度的影响，只需修改 \`b\` 和 \`h\` 的值并重新运行脚本。这种参数化方法是 APDL 进行批量分析和优化设计的基础。

## 数组参数与 *DIM 命令

除了标量参数，APDL 还支持数组参数。数组参数可以存储一组有序的数据，适合在循环中记录中间结果或定义表格型数据。

\`*DIM\` 命令用于定义数组参数，语法为：\`*DIM, Par, Type, IMAX, JMAX, KMAX\`。其中 Par 是数组名，Type 是数组类型（ARRAY 为数值数组，CHAR 为字符数组，TABLE 为表格数组），IMAX/JMAX/KMAX 分别是各维度的大小。

~~~apdl
! 定义一维数组，大小为 10
*DIM,stresses,ARRAY,10

! 定义二维数组（5行3列）
*DIM,results,ARRAY,5,3

! 赋值数组元素
stresses(1) = 120e6
stresses(2) = 135e6
stresses(3) = 98e6

! 在循环中填充数组
*DO,i,1,10
  stresses(i) = i * 15e6
*ENDDO

! 表格数组可以使用非整数索引
*DIM,load_table,TABLE,5,1,1,TIME
load_table(1,0) = 0        ! 时间 0
load_table(2,0) = 0.5      ! 时间 0.5
load_table(3,0) = 1.0      ! 时间 1.0
load_table(4,0) = 2.0      ! 时间 2.0
load_table(5,0) = 3.0      ! 时间 3.0
load_table(1,1) = 0        ! 载荷值
load_table(2,1) = 5000
load_table(3,1) = 10000
load_table(4,1) = 5000
load_table(5,1) = 0
~~~

表格数组（TABLE 类型）在定义随时间变化的载荷时特别有用。APDL 会自动在表格数据点之间进行线性插值，非常适合瞬态分析中的载荷时间历程定义。数组参数与 \`*VGET\` 配合使用，可以批量读取后处理数据；与 \`*VPUT\` 配合使用，可以将计算结果写回数据库。

## 本节要点

APDL 参数通过赋值语句定义，支持算术运算和比较运算。\`*GET\` 命令可以从数据库中提取几何信息、网格信息和后处理结果，是实现自动化分析的关键。\`*VGET\` 用于批量提取数组数据。参数替换 \`%param%\` 可以在命令和文件名中动态插入参数值。养成参数化建模的习惯，能够显著提高分析效率和脚本的可维护性。

> 📝 **相关练习**：[ex-apdl-param-01] 用 *GET 提取关键结果
`,

  'apdl-control-flow': String.raw`
流程控制让 APDL 脚本具备判断和循环能力。条件语句根据参数值选择不同执行路径，循环语句重复执行一组命令。结合 \`*GET\` 提取的结果数据，流程控制可以实现自动化的参数扫描、收敛性检查和批量分析。

## *IF 条件语句

\`*IF\` 是 APDL 的条件判断命令，语法格式为：\`*IF, VAL1, OP, VAL2, THEN\`。其中 VAL1 和 VAL2 是要比较的值或参数，OP 是比较运算符（EQ、NE、LT、GT、LE、GE），THEN 表示条件为真时执行后续语句。

~~~apdl
! 简单条件判断
max_stress = 250e6
allow_stress = 300e6

*IF,max_stress,LT,allow_stress,THEN
  ! 应力满足要求时的操作
  safety_factor = allow_stress / max_stress
*ENDIF
~~~

## *ELSEIF 与 *ELSE

多层条件判断使用 \`*ELSEIF\` 和 \`*ELSE\`：

~~~apdl
max_disp = 0.005       ! 最大位移 5 mm
limit_disp = 0.01      ! 允许位移 10 mm

*IF,max_disp,LE,limit_disp*0.5,THEN
  ! 位移小于允许值的一半，设计偏保守
  status = 'conservative'
*ELSEIF,max_disp,LE,limit_disp,THEN
  ! 位移在允许范围内
  status = 'acceptable'
*ELSEIF,max_disp,LE,limit_disp*1.2,THEN
  ! 位移略微超限
  status = 'marginal'
*ELSE
  ! 位移严重超限
  status = 'failed'
*ENDIF
~~~

\`*IF\` / \`*ELSEIF\` / \`*ELSE\` / \`*ENDIF\` 构成完整的条件块。APDL 从上到下检查每个条件，执行第一个满足条件的分支后跳过其余分支。

**逻辑组合**

APDL 不支持 \`AND\`/\`OR\` 直接写在 \`*IF\` 中，但可以使用嵌套 \`*IF\` 实现等效逻辑：

~~~apdl
stress = 200e6
disp = 0.008
stress_limit = 300e6
disp_limit = 0.01

*IF,stress,LT,stress_limit,THEN
  *IF,disp,LT,disp_limit,THEN
    result = 'both OK'
  *ELSE
    result = 'disp failed'
  *ENDIF
*ELSE
  result = 'stress failed'
*ENDIF
~~~

## *DO 循环

\`*DO\` 循环用于已知循环次数的场景，语法为：\`*DO, Par, ISTART, IEND, IINC\`。其中 Par 是循环计数器参数名，ISTART 是起始值，IEND 是终止值，IINC 是步长（可省略，默认为 1）。

~~~apdl
! 循环 5 次
*DO,i,1,5
  *MSG,'当前循环 i = %i%'
*ENDDO
~~~

循环计数器 \`i\` 是一个普通参数，可以在循环体内使用。每次迭代后 \`i\` 自动增加步长值，直到超过终止值。

~~~apdl
! 带步长的循环
*DO,x,0,1,0.2
  *MSG,'x = %x%'
*ENDDO
~~~

上述循环中 \`x\` 依次取值 0、0.2、0.4、0.6、0.8、1.0。

## *DOWHILE 条件循环

\`*DOWHILE\` 在每次循环开始前检查条件，条件为真时继续循环：

~~~apdl
! 迭代计算直到收敛
error = 1.0
tolerance = 1e-6
iteration = 0

*DOWHILE,error,GT,tolerance
  iteration = iteration + 1
  error = error * 0.5
  *IF,iteration,GT,100,THEN
    *EXIT          ! 超过最大迭代次数则退出
  *ENDIF
*ENDDO
~~~

\`*DOWHILE\` 适合不知道确切循环次数、需要根据计算结果决定是否继续的场景。

## *REPEAT 重复命令

\`*REPEAT\` 用于重复执行前一条命令，语法为：\`*REPEAT, NTOT, VINC1, VINC2, ..., VINC8\`。其中 NTOT 是总执行次数（包括原始的那一次），VINC 是各参数的增量。

~~~apdl
! 创建一系列等间距的关键点
K,1,0,0,0           ! 第一个关键点
*REPEAT,11,1,0.1,0,0 ! 重复 11 次，编号每次+1，X 每次+0.1
~~~

上述代码创建编号 1 到 11 的关键点，X 坐标分别为 0、0.1、0.2、...、1.0。\`*REPEAT\` 在创建等间距几何或网格时非常高效。

## *EXIT 与 *CYCLE 循环控制

\`*EXIT\` 立即退出当前循环，\`*CYCLE\` 跳过当前迭代的剩余语句直接进入下一次迭代：

~~~apdl
*DO,i,1,100
  *GET,val,NODE,i,U,Y

  *IF,val,GT,0.1,THEN
    *CYCLE            ! 跳过本次，继续下一次
  *ENDIF

  ! 正常处理逻辑
  ! ...

  *IF,val,LT,1e-8,THEN
    *EXIT             ! 退出循环
  *ENDIF
*ENDDO
~~~

\`*EXIT\` 等价于 Python 的 \`break\`，\`*CYCLE\` 等价于 \`continue\`。

## *ASK 用户交互

\`*ASK\` 在运行时弹出输入提示，让用户提供参数值：

~~~apdl
*ASK,beam_width,'请输入梁的宽度（米）：',0.05
*ASK,beam_height,'请输入梁的高度（米）：',0.1
~~~

第一个参数是接收输入的变量名，第二个是提示文字，第三个是默认值。用户输入后参数被赋值。这个命令在创建交互式脚本时很有用，但在批处理模式下应避免使用。

## *MSG 格式化消息

\`*MSG\` 用于输出格式化消息，支持参数替换：

~~~apdl
*MSG,'分析完成'
*MSG,'最大应力 = %max_stress% Pa'
*MSG,'位移 = %disp% m，安全系数 = %sf%'
~~~

消息内容中使用 \`%参数名%\` 格式进行替换。多条消息会依次输出到输出窗口。

## 嵌套控制结构

控制结构可以相互嵌套，形成复杂的逻辑：

~~~apdl
! 嵌套循环：外层遍历材料，内层遍历载荷步
*DO,mat_id,1,3
  *DO,load_step,1,5
    ESEL,S,MAT,,mat_id
    SET,load_step
    *GET,maxS,PLNSOL,S,EQV,0,MAX
    *MSG,'材料%mat_id% 载荷步%load_step%: 最大应力=%maxS%'
  *ENDDO
  ALLSEL,ALL
*ENDDO
~~~

嵌套深度没有严格限制，但超过三层的嵌套会使代码难以阅读和维护。

## 实际案例一：参数扫描研究

以下示例演示如何用循环自动进行参数扫描。改变梁的宽度，记录每种宽度下的最大挠度：

~~~apdl
! =============================================
! 参数扫描：梁宽度对最大挠度的影响
! =============================================

h = 0.1
L = 1.0
q = 10000
E_mod = 2.1e11
nu = 0.3

*DIM,widths,ARRAY,5
*DIM,deflections,ARRAY,5

*DO,idx,1,5
  b = 0.02 + (idx-1) * 0.02
  widths(idx) = b

  /PREP7
  ANTYPE,STATIC
  ET,1,BEAM188
  MP,EX,1,E_mod
  MP,PRXY,1,nu
  SECTYPE,1,BEAM,RECT
  SECDATA,b,h
  K,1,0,0,0
  K,2,L,0,0
  L,1,2
  LESIZE,ALL,,,20
  LMESH,ALL
  FINISH

  /SOLU
  DK,1,ALL,0
  SFBEAM,ALL,1,PRES,q
  SOLVE
  FINISH

  /POST1
  SET,LAST
  *GET,deflections(idx),PLNSOL,U,Y,0,MIN
  FINISH

  *MSG,'宽度=%b% m, 挠度=%deflections(idx)% m'
*ENDDO

*MSG,'========== 参数扫描结果 =========='
*DO,idx,1,5
  *MSG,'宽度 = %widths(idx)% m, 挠度 = %deflections(idx)% m'
*ENDDO
~~~

## 实际案例二：网格收敛性检查

以下示例演示如何用循环自动细化网格，直到结果收敛：

~~~apdl
! =============================================
! 网格收敛性检查
! =============================================

L = 1.0
b = 0.05
h = 0.1
P = 10000
E_mod = 2.1e11
nu = 0.3

tolerance = 0.01
max_refine = 6
prev_defl = 0

*DIM,n_elems,ARRAY,max_refine
*DIM,max_defls,ARRAY,max_refine
converged = 0

*DO,refine,1,max_refine
  n_div = 4 * refine
  n_elems(refine) = n_div

  /PREP7
  ET,1,BEAM188
  MP,EX,1,E_mod
  MP,PRXY,1,nu
  SECTYPE,1,BEAM,RECT
  SECDATA,b,h
  K,1,0,0,0
  K,2,L,0,0
  L,1,2
  LESIZE,ALL,,,n_div
  LMESH,ALL
  FINISH

  /SOLU
  DK,1,ALL,0
  FK,2,FY,-P
  SOLVE
  FINISH

  /POST1
  SET,LAST
  *GET,max_defls(refine),PLNSOL,U,Y,0,MIN
  FINISH

  *IF,refine,GT,1,THEN
    diff = ABS(max_defls(refine) - prev_defl) / ABS(prev_defl)
    *IF,diff,LT,tolerance,THEN
      converged = 1
      *MSG,'在第 %refine% 次细化时收敛！误差 = %diff%'
      *EXIT
    *ENDIF
  *ENDIF
  prev_defl = max_defls(refine)
  *MSG,'单元数=%n_div%, 挠度=%max_defls(refine)% m'
*ENDDO

*IF,converged,EQ,0,THEN
  *MSG,'警告：达到最大细化次数仍未收敛'
*ENDIF
~~~

这个例子展示了工程分析中非常重要的网格收敛性验证流程。随着网格细化，结果应该趋于稳定。当相邻两次网格的结果差异小于设定的容差时，认为网格已经足够精细。

## 流程控制的实用技巧

编写包含流程控制的 APDL 脚本时，以下几点经验值得注意：

**避免无限循环**：使用 \`*DOWHILE\` 时必须确保循环条件最终会变为假。建议设置最大迭代次数作为安全阀，超过后强制退出并输出警告信息。

~~~apdl
max_iter = 50
iter = 0
converged = 0

*DOWHILE,converged,EQ,0
  iter = iter + 1
  ! ... 执行计算 ...

  *IF,误差条件满足,THEN
    converged = 1
  *ENDIF

  *IF,iter,GT,max_iter,THEN
    *MSG,'达到最大迭代次数 %max_iter%，停止计算'
    *EXIT
  *ENDIF
*ENDDO
~~~

**循环中清理模型**：在参数扫描循环中，每次迭代开始前应使用 \`/CLEAR\` 或 \`FINISH\` + \`/PREP7\` 重置模型状态，否则前一次迭代的几何、网格和载荷会累积到下一次，导致不可预测的错误。

**输出管理**：循环中产生大量输出时，使用 \`/OUTPUT\` 将结果重定向到文件，避免输出窗口被淹没。循环结束后再恢复屏幕输出，统一查看汇总结果。

**错误处理**：在关键操作后检查 \`_STATUS\` 和 \`_NERR\` 系统参数。如果求解失败，应跳过该次迭代的后处理，避免在无结果的情况下调用 \`SET\` 等命令产生额外错误。

~~~apdl
/SOLU
SOLVE
FINISH

*IF,_STATUS,NE,0,THEN
  *MSG,'求解失败，跳过本次后处理'
  *CYCLE
*ENDIF
~~~

掌握这些技巧后，可以编写出更加健壮的自动化分析脚本，在批量计算和参数研究中发挥 APDL 的全部潜力。

## 本节要点

APDL 流程控制包括条件判断（\`*IF\`/\`*ELSEIF\`/\`*ELSE\`/\`*ENDIF\`）和循环（\`*DO\`/\`*ENDDO\`、\`*DOWHILE\`/\`*ENDDO\`）。\`*EXIT\` 退出循环，\`*CYCLE\` 跳过当前迭代。\`*REPEAT\` 快速重复上一条命令。\`*ASK\` 获取用户输入，\`*MSG\` 输出格式化消息。嵌套控制结构可以实现复杂的分析逻辑，如参数扫描和收敛性检查。实际工程中，流程控制与 \`*GET\` 配合使用，可以实现完全自动化的批量分析和结果评估。

> 📝 **相关练习**：[ex-apdl-loop-01] 实现参数扫描循环
`,

  'apdl-static-example': String.raw`
本节通过一个完整的悬臂梁静力学分析案例，从头到尾演示 APDL 的完整工作流程。每一行代码都有详细解释，确保理解每个步骤的目的和参数含义。

## 问题描述

分析一根钢制悬臂梁在均布载荷作用下的变形和应力。

**几何参数：** 梁长度 L = 1.0 m，截面宽度 b = 50 mm = 0.05 m，截面高度 h = 100 mm = 0.1 m。

**材料参数（结构钢）：** 弹性模量 E = 2.1e11 Pa (210 GPa)，泊松比 v = 0.3，密度 rho = 7850 kg/m3。

**载荷条件：** 均布载荷 q = 10 kN/m = 10000 N/m（沿梁长度方向向下施加），固定端在左端（X = 0），所有自由度约束。

**理论参考值：** 最大挠度（自由端）约 1.43 mm，最大弯矩（固定端）M = qL2/2 = 5000 N-m，最大弯曲应力约 60 MPa。

## 完整 APDL 脚本

~~~apdl
! =============================================
! 悬臂梁静力学分析——完整 APDL 脚本
! 模型：钢制矩形截面悬臂梁
! 载荷：均布载荷 10 kN/m
! =============================================

! ---- 参数定义 ----
L  = 1.0                 ! 梁长度 (m)
b  = 0.05                ! 截面宽度 (m)
h  = 0.1                 ! 截面高度 (m)
q  = 10000               ! 均布载荷 (N/m)
EX_val = 2.1e11          ! 弹性模量 (Pa)
NU_val = 0.3             ! 泊松比
RHO_val = 7850           ! 密度 (kg/m³)

! 截面惯性矩
I_sec = b * h**3 / 12   ! = 4.167e-6 m^4
~~~

首先定义所有参数。将数值赋给参数名而非直接写在命令中，这样修改参数后只需重新运行脚本即可。截面惯性矩作为派生参数也一并计算。

### 第一步：前处理 /PREP7

~~~apdl
! ---- 进入前处理器 ----
/PREP7

! 定义单元类型
! BEAM188 是三维线性梁单元，支持多种截面形状
! 适用于静力学、模态和瞬态分析
ET,1,BEAM188

! 设置单元选项
! KEYOPT(3) = 2 表示使用三次形函数（提高弯曲精度）
KEYOPT,1,3,2

! 定义材料属性
MP,EX,1,EX_val           ! 弹性模量 210 GPa
MP,PRXY,1,NU_val         ! 泊松比 0.3
MP,DENS,1,RHO_val        ! 密度 7850 kg/m³

! 定义梁截面
SECTYPE,1,BEAM,RECT      ! 截面编号 1，梁单元，矩形
SECDATA,b,h              ! 宽度 b，高度 h

! 创建几何——关键点
K,1,0,0,0                ! 关键点 1：固定端 (0, 0, 0)
K,2,L,0,0                ! 关键点 2：自由端 (L, 0, 0)

! 创建几何——线
L,1,2                    ! 连接关键点 1 和 2 创建线 1

! 设置网格划分参数
LESIZE,ALL,,,20          ! 将所有线划分为 20 个单元

! 分配属性并划分网格
LATT,1,,1,,,1            ! 材料1, 无实常数, 类型1, , , 截面1

! 划分网格
LMESH,ALL                ! 对选中的线进行网格划分

! 检查网格
/PSYMB,ESYS,1            ! 显示单元坐标系
EPLOT                    ! 绘制单元

FINISH                   ! 退出前处理器
~~~

前处理阶段完成了四件事：定义单元类型（BEAM188）、定义材料属性（钢的弹性模量和泊松比）、创建几何（两个关键点和一条线）、划分网格（20 个梁单元）。

### 第二步：求解 /SOLU

~~~apdl
! ---- 进入求解器 ----
/SOLU

! 设置分析类型
ANTYPE,STATIC            ! 静力学分析

! 施加边界条件——固定端约束
! DK 格式：DK, 关键点编号, 自由度, 值
! ALL 表示所有自由度（UX, UY, UZ, ROTX, ROTY, ROTZ）
DK,1,ALL,0               ! 关键点 1 处所有自由度固定为 0

! 施加载荷——均布载荷
! 对于梁单元，使用 SFBEAM 施加分布力
! PRES 表示压力（每单位长度的力），值为 q
ALLSEL,ALL
SFBEAM,ALL,1,PRES,q      ! 在所有梁单元上施加均布压力 q

! 设置求解控制
NLGEOM,OFF               ! 关闭大变形（小变形假设）

! 设置输出控制
OUTRES,ALL,ALL           ! 输出所有结果到结果文件

! 求解
SOLVE                    ! 开始求解

FINISH
~~~

求解阶段的关键步骤：设置分析类型为静力学（\`ANTYPE,STATIC\`），施加固定端约束（\`DK,1,ALL,0\`），施加均布载荷（\`SFBEAM,ALL,1,PRES,q\`），然后执行 \`SOLVE\`。求解器会自动组装刚度矩阵、施加边界条件并求解线性方程组。

### 第三步：后处理 /POST1

~~~apdl
! ---- 进入通用后处理器 ----
/POST1

! 读入结果
SET,LAST                 ! 读入最后一个载荷步的结果

! ---- 查看变形 ----
PLDISP,1                 ! 参数 1 表示同时显示变形前后的轮廓
PLDISP,2                 ! 参数 2 表示只显示变形后的形状

! 获取最大挠度
*GET,max_UY,PLNSOL,U,Y,0,MIN
*MSG,'最大挠度（FEA）= %max_UY% m'

! 计算理论挠度
delta_theory = q * L**4 / (8 * EX_val * I_sec)
*MSG,'最大挠度（理论）= %delta_theory% m'

! ---- 查看应力 ----
PLNSOL,S,EQV             ! 绘制 von Mises 等效应力
PLNSOL,S,X               ! 绘制 X 方向正应力（弯曲应力）

! 获取最大应力
*GET,max_Seqv,PLNSOL,S,EQV,0,MAX
*MSG,'最大 von Mises 应力 = %max_Seqv% Pa'

*GET,max_SX,PLNSOL,S,X,0,MAX
*MSG,'最大弯曲应力（FEA）= %max_SX% Pa'

! 理论最大弯曲应力
M_max = q * L**2 / 2
sigma_theory = M_max * (h/2) / I_sec
*MSG,'最大弯曲应力（理论）= %sigma_theory% Pa'

! ---- 查看反力 ----
PRRSOL,F                 ! 列出所有反力分量
PRRSOL,M                 ! 列出所有反力矩

*GET,FY_react,NODE,1,RF,FY
*MSG,'固定端 Y 反力 = %FY_react% N'

*GET,MZ_react,NODE,1,RF,MZ
*MSG,'固定端 Z 力矩 = %MZ_react% N-m'

FINISH
~~~

后处理阶段做了三件事：查看变形形状并验证最大挠度、查看应力分布并验证最大应力、列出反力并验证平衡条件。每一步都将有限元结果与理论值进行对比，这是工程分析中不可或缺的质量检查步骤。

### 第四步：结果验证

~~~apdl
! ---- 结果验证与误差分析 ----

! 挠度误差
error_defl = ABS(max_UY - delta_theory) / delta_theory * 100
*MSG,'挠度误差 = %error_defl% %%'

! 应力误差
error_stress = ABS(max_SX - sigma_theory) / sigma_theory * 100
*MSG,'弯曲应力误差 = %error_stress% %%'

! 平衡验证
total_load = q * L
error_force = ABS(ABS(FY_react) - total_load) / total_load * 100
*MSG,'力平衡误差 = %error_force% %%'
~~~

验证结果通常显示：挠度误差约 0.1%~2%（取决于单元数量和形函数阶次），弯曲应力误差约 1%~5%（梁单元在应力计算上精度略低于位移），力平衡误差应接近 0（这是线性静力分析的基本保证）。

如果误差过大，应检查：单元数量是否足够（增加 \`LESIZE\` 中的单元数）、截面方向是否正确、载荷施加方式是否与理论假设一致。

## 完整的可运行脚本

将上述所有步骤合并为一个完整的脚本：

~~~apdl
! =============================================
! 悬臂梁静力学分析——完整可运行脚本
! =============================================
FINISH
/CLEAR,NOSTART           ! 清空数据库

! 参数定义
L  = 1.0
b  = 0.05
h  = 0.1
q  = 10000
EX_val = 2.1e11
NU_val = 0.3
I_sec = b * h**3 / 12

! 前处理
/PREP7
ET,1,BEAM188
KEYOPT,1,3,2
MP,EX,1,EX_val
MP,PRXY,1,NU_val
SECTYPE,1,BEAM,RECT
SECDATA,b,h
K,1,0,0,0
K,2,L,0,0
L,1,2
LATT,1,,1,,,1
LESIZE,ALL,,,20
LMESH,ALL
FINISH

! 求解
/SOLU
ANTYPE,STATIC
DK,1,ALL,0
ALLSEL,ALL
SFBEAM,ALL,1,PRES,q
OUTRES,ALL,ALL
SOLVE
FINISH

! 后处理
/POST1
SET,LAST
PLDISP,2
PLNSOL,S,EQV
*GET,max_UY,PLNSOL,U,Y,0,MIN
*GET,max_Seqv,PLNSOL,S,EQV,0,MAX
PRRSOL,F
PRRSOL,M

delta_theory = q * L**4 / (8 * EX_val * I_sec)
M_max = q * L**2 / 2
sigma_theory = M_max * (h/2) / I_sec

*MSG,'=== 结果汇总 ==='
*MSG,'最大挠度 FEA:  %max_UY% m'
*MSG,'最大挠度理论: %delta_theory% m'
*MSG,'最大应力 FEA:  %max_Seqv% Pa'
*MSG,'最大应力理论: %sigma_theory% Pa'
FINISH
~~~

这个脚本可以直接复制粘贴到 ANSYS APDL 命令窗口中运行。运行后图形窗口会显示变形图和应力等值线图，输出窗口会显示结果数值和理论对比。

## 进一步扩展

本案例是线弹性静力学分析的最基本形式。在此基础上可以进行多种扩展：将均布载荷改为集中力或压力组合、添加自重载荷（\`ACEL\` 命令）、增加梁的截面变化、引入多材料段、或者打开大变形选项（\`NLGEOM,ON\`）进行几何非线性分析。无论分析如何复杂化，上述四步流程——前处理、求解、后处理、验证——始终是有限元分析的核心框架。参数化的脚本使得这些扩展变得容易实现，只需修改或添加少量命令即可探索不同的设计方案。

## 本节要点

静力学分析的完整流程为：参数定义 -> /PREP7（单元类型、材料、几何、网格） -> /SOLU（约束、载荷、求解） -> /POST1（变形、应力、反力）。每个阶段之间必须用 \`FINISH\` 退出当前处理器。结果验证是分析工作不可分割的一部分——将有限元结果与手算理论值对比，检查挠度误差、应力误差和力平衡误差是否在可接受范围内。使用参数化脚本可以让同一套代码适配不同尺寸和载荷的梁分析。

> 📝 **相关练习**：[ex-apdl-static-01] 验证静力分析结果
`,

  'apdl-modal-example': String.raw`
模态分析用于确定结构的固有频率和振型。固有频率是结构自由振动时的频率，振型是对应的变形形态。模态分析是动力学分析的基础——在进行瞬态分析、谐响应分析或响应谱分析之前，通常需要先做模态分析以了解结构的动力学特性。

## 问题描述

分析一块钢制矩形薄板的前 10 阶固有频率和振型。

**几何参数：** 板长度 a = 1.0 m，板宽度 b = 0.5 m，板厚度 t = 10 mm = 0.01 m。

**材料参数（结构钢）：** 弹性模量 E = 2.1e11 Pa (210 GPa)，泊松比 v = 0.3，密度 rho = 7850 kg/m3。

**边界条件：** 四边简支（约束法向位移，允许面内滑动）。

**理论参考（简支矩形板）：** 第 (m,n) 阶固有频率公式为 f = (pi/2) x sqrt(D/(rho x t)) x [(m/a)^2 + (n/b)^2]，其中 D = E x t^3 / (12(1-v^2)) 为板的弯曲刚度。

## 完整 APDL 脚本

~~~apdl
! =============================================
! 矩形薄板模态分析——完整 APDL 脚本
! =============================================
FINISH
/CLEAR,NOSTART           ! 清空数据库

! ---- 参数定义 ----
a  = 1.0                 ! 板长度 (m)
b  = 0.5                 ! 板宽度 (m)
t  = 0.01                ! 板厚度 (m)
EX_val = 2.1e11          ! 弹性模量 (Pa)
NU_val = 0.3             ! 泊松比
RHO_val = 7850           ! 密度 (kg/m³)
n_modes = 10             ! 求解模态数

! 计算弯曲刚度（用于理论对比）
D_plate = EX_val * t**3 / (12 * (1 - NU_val**2))
~~~

首先定义参数。模态分析必须定义密度（\`DENS\`），因为固有频率与质量直接相关。弯曲刚度 D 作为参考值计算。

### 第一步：前处理 /PREP7

~~~apdl
! ---- 进入前处理器 ----
/PREP7

! 定义单元类型
! SHELL181 是四节点壳单元，适用于薄到中等厚度的壳结构
ET,1,SHELL181

! 定义材料属性
MP,EX,1,EX_val           ! 弹性模量
MP,PRXY,1,NU_val         ! 泊松比
MP,DENS,1,RHO_val        ! 密度（模态分析必须定义！）

! 定义截面（壳厚度）
SECTYPE,1,SHELL          ! 定义壳截面
SECDATA,t                ! 壳厚度 = 0.01 m

! 创建几何——关键点
K,1,0,0,0                ! 左下角
K,2,a,0,0                ! 右下角
K,3,a,b,0                ! 右上角
K,4,0,b,0                ! 左上角

! 创建几何——面
A,1,2,3,4                ! 由四个关键点创建面

! 设置网格划分参数
LESIZE,1,,,20            ! 线 1（底边）：20 个单元
LESIZE,3,,,20            ! 线 3（顶边）：20 个单元
LESIZE,2,,,10            ! 线 2（右边）：10 个单元
LESIZE,4,,,10            ! 线 4（左边）：10 个单元

! 分配属性并划分网格
AATT,1,,1,,1            ! 材料1, 无实常数, 类型1, , 截面1
AMESH,ALL                ! 划分面的网格

! 检查网格质量
SHPP,SUMMARY             ! 显示网格质量摘要

FINISH                   ! 退出前处理器
~~~

前处理中需要特别注意以下几点：第一，必须定义密度（\`MP,DENS\`），否则模态分析无法计算质量矩阵。第二，SHELL181 是壳单元，通过 \`SECTYPE\` 和 \`SECDATA\` 定义厚度。第三，网格密度影响频率精度——高阶模态需要更精细的网格。本例用 20x10 的网格，前几阶模态精度较好。

### 第二步：施加约束

~~~apdl
! ---- 施加四边简支约束 ----
/PREP7

! 底边节点（Y=0）
NSEL,S,LOC,Y,0
D,ALL,UZ,0               ! 约束 Z 方向位移

! 顶边节点（Y=b）
NSEL,S,LOC,Y,b
D,ALL,UZ,0

! 左边节点（X=0）
NSEL,S,LOC,X,0
D,ALL,UZ,0

! 右边节点（X=a）
NSEL,S,LOC,X,a
D,ALL,UZ,0

! 额外约束：防止刚体运动
! 约束一个角点的面内位移
NSEL,S,LOC,X,0
NSEL,R,LOC,Y,0
D,ALL,UX,0
D,ALL,UY,0

! 恢复全选
ALLSEL,ALL
FINISH
~~~

简支约束意味着边界上的法向位移（Z 方向）被限制，但面内位移和转动自由度是允许的。为了防止刚体平动，额外约束了左下角节点的面内位移。

### 第三步：模态分析求解

~~~apdl
! ---- 进入求解器 ----
/SOLU

! 设置分析类型为模态分析
ANTYPE,MODAL             ! 模态分析

! 设置模态提取方法
! LANB = Block Lanczos 方法（推荐用于大型模型）
MODOPT,LANB,n_modes      ! 用 Lanczos 方法提取前 10 阶模态

! 设置模态扩展
! MXPAND 控制是否计算振型
MXPAND,n_modes,,,YES     ! 扩展前 10 阶模态，YES 表示计算单元结果

! 质量矩阵类型
LUMPM,OFF                ! 一致质量矩阵（默认，精度更高）

! 不需要施加载荷！模态分析只关心自由振动。

! 求解
SOLVE
FINISH
~~~

模态分析求解的关键设置：\`ANTYPE,MODAL\` 指定模态分析类型。\`MODOPT,LANB,10\` 使用 Block Lanczos 方法提取前 10 阶模态，这是 ANSYS 推荐的首选方法。\`MXPAND,10,,,YES\` 扩展模态，即计算每个模态对应的振型和应力。不需要施加载荷——模态分析求解的是自由振动问题。

### 第四步：后处理查看结果

~~~apdl
! ---- 进入通用后处理器 ----
/POST1

! 列出所有固有频率
SET,LIST                 ! 显示所有模态的频率列表

! 查看第一阶模态振型
SET,1,1                  ! 读入第 1 阶模态的结果
PLDISP,1                 ! 绘制变形图（显示变形前后轮廓）
PLDISP,2                 ! 只绘制变形后的形状

! 查看第二阶模态振型
SET,1,2
PLDISP,2

! 查看第三阶模态振型
SET,1,3
PLDISP,2

! 绘制各阶模态的应力分布
SET,1,1
PLNSOL,S,EQV             ! 第 1 阶模态的等效应力

! 获取特定频率值
*GET,freq1,MODE,1,FREQ
*GET,freq2,MODE,2,FREQ
*GET,freq3,MODE,3,FREQ

*MSG,'第 1 阶固有频率 = %freq1% Hz'
*MSG,'第 2 阶固有频率 = %freq2% Hz'
*MSG,'第 3 阶固有频率 = %freq3% Hz'

! 理论计算第一阶频率（简支板 m=1, n=1）
f_theory_11 = (3.14159265/2) * (D_plate/(RHO_val*t))**0.5 &
              * ((1/a)**2 + (1/b)**2)
*MSG,'理论第 1 阶频率 (m=1,n=1) = %f_theory_11% Hz'

FINISH
~~~

\`SET,LIST\` 会输出一个表格，列出所有模态的编号、频率（Hz）和周期（s）。\`SET,1,n\` 用于读入第 n 阶模态的结果进行后处理。注意模态分析中的位移值是归一化的（相对值），不代表真实位移量——它们表示的是振型形状，而不是变形幅度。

### 第五步：动画显示振型

~~~apdl
! ---- 动画显示 ----
/POST1

SET,1,1
ANMODE,10,0.05,,0        ! 10 帧动画，帧间延迟 0.05 秒

SET,1,2
ANMODE,10,0.05,,0

SET,1,3
ANMODE,10,0.05,,0
~~~

\`ANMODE\` 生成模态振型动画。第一个参数是动画帧数，第二个是帧间延迟（秒），第四个参数控制是否循环播放。动画可以直观地展示结构在各阶固有频率下的振动形态。

## 完整的可运行脚本

~~~apdl
! =============================================
! 矩形薄板模态分析——完整可运行脚本
! =============================================
FINISH
/CLEAR,NOSTART

a = 1.0
b = 0.5
t = 0.01
EX_val = 2.1e11
NU_val = 0.3
RHO_val = 7850
n_modes = 10
D_plate = EX_val * t**3 / (12 * (1 - NU_val**2))

/PREP7
ET,1,SHELL181
MP,EX,1,EX_val
MP,PRXY,1,NU_val
MP,DENS,1,RHO_val
SECTYPE,1,SHELL
SECDATA,t
K,1,0,0,0
K,2,a,0,0
K,3,a,b,0
K,4,0,b,0
A,1,2,3,4
LESIZE,1,,,20
LESIZE,3,,,20
LESIZE,2,,,10
LESIZE,4,,,10
AATT,1,,1,,1
AMESH,ALL

NSEL,S,LOC,Y,0
D,ALL,UZ,0
NSEL,S,LOC,Y,b
D,ALL,UZ,0
NSEL,S,LOC,X,0
D,ALL,UZ,0
NSEL,S,LOC,X,a
D,ALL,UZ,0
NSEL,S,LOC,X,0
NSEL,R,LOC,Y,0
D,ALL,UX,0
D,ALL,UY,0
ALLSEL,ALL
FINISH

/SOLU
ANTYPE,MODAL
MODOPT,LANB,n_modes
MXPAND,n_modes,,,YES
LUMPM,OFF
SOLVE
FINISH

/POST1
SET,LIST

SET,1,1
PLDISP,2
*GET,freq1,MODE,1,FREQ
*MSG,'第 1 阶频率 = %freq1% Hz'

SET,1,2
PLDISP,2
*GET,freq2,MODE,2,FREQ
*MSG,'第 2 阶频率 = %freq2% Hz'

SET,1,3
PLDISP,2
*GET,freq3,MODE,3,FREQ
*MSG,'第 3 阶频率 = %freq3% Hz'

f11 = (3.14159265/2) * (D_plate/(RHO_val*t))**0.5 &
      * ((1/a)**2 + (1/b)**2)
*MSG,'理论第 1 阶频率 = %f11% Hz'

SET,1,1
ANMODE,10,0.05,,0

FINISH
~~~

## 模态分析结果解读

模态分析的输出包括固有频率和振型两部分。**固有频率**是结构自由振动的特征频率。当外部激励频率接近某一阶固有频率时，结构会产生共振，导致响应急剧增大。工程设计中通常要求工作频率避开结构的前几阶固有频率，一般保持至少 20%~30% 的频率间隔。例如，如果电机转速为 1500 rpm（25 Hz），而结构的第一阶固有频率为 28 Hz，则需要修改设计以避免共振。

**振型**表示结构在对应频率下自由振动时的变形形态。第一阶振型通常是整体弯曲，频率最低；高阶振型包含更多节点线（振幅为零的线），形状更复杂。了解振型有助于确定传感器布置位置和减振方案。

## 模态分析中的常见问题

**忘记定义密度**是最常见的错误。没有密度意味着没有质量矩阵，模态分析会报错或给出不合理的结果。

**刚体模态**出现在约束不足的情况下。如果结构没有足够的约束，前几阶"模态"实际上是刚体运动（频率接近零），应检查约束设置。

**网格太粗**会导致高阶模态频率偏高。对于需要高阶模态的分析，应进行网格收敛性验证。

**质量矩阵类型**的选择：一致质量矩阵精度更高但计算量更大，集中质量矩阵计算更快但在高阶模态上可能有误差。初步分析可用集中质量矩阵，最终分析用一致质量矩阵。

## 本节要点

模态分析的完整流程为：定义密度和材料 -> 建模和网格划分 -> 施加约束（无外载荷） -> \`ANTYPE,MODAL\` 设置模态分析 -> \`MODOPT\` 选择提取方法和模态数 -> \`MXPAND\` 设置模态扩展 -> 求解 -> \`SET,LIST\` 查看频率列表 -> \`SET,1,n\` 配合 \`PLDISP\` 查看各阶振型 -> \`ANMODE\` 制作动画。固有频率是结构设计的核心参数，必须与外部激励频率保持足够距离以避免共振。模态分析是后续瞬态分析、谐响应分析和响应谱分析的基础。

> 📝 **相关练习**：[ex-apdl-modal-01] 分析边界条件对固有频率的影响
`,

  'apdl-summary': String.raw`
经过前面各节的学习，我们已经掌握了 APDL 从建模到求解再到后处理的完整流程。本节回顾核心知识点，总结常见错误，并展望进阶学习方向。

## APDL 完整工作流程回顾

ANSYS APDL 的分析流程由四个处理器串联而成：前处理器 \`/PREP7\`（定义单元类型、材料、几何和网格）、求解器 \`/SOLU\`（施加载荷和约束，执行求解）、通用后处理器 \`/POST1\`（查看某一时刻的全场结果）、时间历程后处理器 \`/POST26\`（查看结果随时间/频率变化的曲线）。

每次切换处理器之前，必须用 \`FINISH\` 退出当前处理器。这是 APDL 的基本规则。

一个典型的完整脚本结构如下：

~~~apdl
! 初始化
FINISH
/CLEAR,NOSTART

! 参数定义
L = 1.0
b = 0.05
h = 0.1
E_val = 2.1e11

! 前处理
/PREP7
ET,1,BEAM188
MP,EX,1,E_val
MP,PRXY,1,0.3
! ... 建模和网格划分 ...
FINISH

! 求解
/SOLU
ANTYPE,STATIC
! ... 约束和载荷 ...
SOLVE
FINISH

! 后处理
/POST1
SET,LAST
PLNSOL,S,EQV
FINISH

! 时间历程后处理（如需要）
/POST26
NSOL,2,100,U,Y
PLVAR,2
FINISH
~~~

## 常用命令速查表

### 前处理 /PREP7

| 命令 | 功能 | 示例 |
|------|------|------|
| \`ET\` | 定义单元类型 | \`ET,1,SOLID185\` |
| \`MP\` | 定义材料属性 | \`MP,EX,1,2.1e11\` |
| \`K\` | 创建关键点 | \`K,1,0,0,0\` |
| \`L\` | 创建线 | \`L,1,2\` |
| \`A\` | 创建面 | \`A,1,2,3,4\` |
| \`V\` | 创建体 | \`V,1,2,3,4,5,6,7,8\` |
| \`ESIZE\` | 全局单元尺寸 | \`ESIZE,,4\` |
| \`LESIZE\` | 线上网格 | \`LESIZE,1,,,20\` |
| \`AMESH\` | 面网格划分 | \`AMESH,ALL\` |
| \`VMESH\` | 体网格划分 | \`VMESH,ALL\` |
| \`SECTYPE\` | 定义截面 | \`SECTYPE,1,BEAM,RECT\` |
| \`SECDATA\` | 截面数据 | \`SECDATA,b,h\` |
| \`LATT\` | 线属性分配 | \`LATT,1,,1,,,1\` |
| \`AATT\` | 面属性分配 | \`AATT,1,,1,,1\` |

### 求解 /SOLU

| 命令 | 功能 | 示例 |
|------|------|------|
| \`ANTYPE\` | 分析类型 | \`ANTYPE,STATIC\` |
| \`D\` | 位移约束 | \`D,ALL,UZ,0\` |
| \`DK\` | 关键点约束 | \`DK,1,ALL,0\` |
| \`F\` | 集中力 | \`FK,2,FY,-10000\` |
| \`SF\` | 面载荷 | \`SF,ALL,PRES,1e6\` |
| \`SFBEAM\` | 梁分布载荷 | \`SFBEAM,ALL,1,PRES,q\` |
| \`BF\` | 体载荷 | \`BF,ALL,TEMP,100\` |
| \`SOLVE\` | 求解 | \`SOLVE\` |
| \`NLGEOM\` | 大变形开关 | \`NLGEOM,ON\` |
| \`NSUBST\` | 子步数 | \`NSUBST,10,100,5\` |
| \`OUTRES\` | 输出控制 | \`OUTRES,ALL,ALL\` |

### 后处理 /POST1 与 /POST26

| 命令 | 功能 | 示例 |
|------|------|------|
| \`SET\` | 读入结果 | \`SET,LAST\` |
| \`PLDISP\` | 绘制变形 | \`PLDISP,2\` |
| \`PLNSOL\` | 节点解等值线 | \`PLNSOL,S,EQV\` |
| \`PLESOL\` | 单元解等值线 | \`PLESOL,S,X\` |
| \`PRNSOL\` | 列表节点解 | \`PRNSOL,U,COMP\` |
| \`PRRSOL\` | 列表反力 | \`PRRSOL,F\` |
| \`*GET\` | 提取数据 | \`*GET,maxS,PLNSOL,S,EQV,0,MAX\` |
| \`NSOL\` | POST26 节点变量 | \`NSOL,2,100,U,Y\` |
| \`PLVAR\` | 绘制变量曲线 | \`PLVAR,2\` |
| \`PRVAR\` | 列表变量数据 | \`PRVAR,2\` |

### 选择与组件

| 命令 | 功能 | 示例 |
|------|------|------|
| \`NSEL\` | 选择节点 | \`NSEL,S,LOC,Y,0\` |
| \`ESEL\` | 选择单元 | \`ESEL,S,MAT,,1\` |
| \`NSLA\` | 选面上节点 | \`NSLA,S,ALL\` |
| \`CM\` | 创建组件 | \`CM,FIX_NODES,NODE\` |
| \`CMSEL\` | 选择组件 | \`CMSEL,S,FIX_NODES\` |
| \`ALLSEL\` | 恢复全选 | \`ALLSEL,ALL\` |

## 常见错误与避免方法

### 1. 忘记 FINISH

~~~apdl
! 错误写法：直接从 /PREP7 进入 /SOLU
/PREP7
! ... 建模 ...
/SOLU                    ! 此时仍在 /PREP7 中，命令可能出错

! 正确写法
/PREP7
! ... 建模 ...
FINISH                   ! 先退出
/SOLU                    ! 再进入
~~~

每次切换处理器前必须执行 \`FINISH\`。这是最常见的错误之一。

### 2. 未转换载荷

在某些分析中，特别是从 CAD 导入几何后或在参数化建模中，需要确保载荷正确施加到了目标实体上。如果使用 \`SBCTRAN\`（实体模型载荷转换），应在求解前执行：

~~~apdl
SBCTRAN
SOLVE
~~~

如果载荷直接施加在节点和单元上（如 \`D,ALL,UZ,0\` 在选中的节点上），则不需要 \`SBCTRAN\`。但如果在关键点或面上施加载荷（如 \`DK,1,ALL,0\` 或 \`SFA,1,1,PRES,1e6\`），求解器会在 \`SOLVE\` 时自动转换，通常不需要手动调用。

### 3. 单位不一致

ANSYS 本身没有单位系统——它假设用户输入的所有数据使用一致的单位。最常见的错误是混用单位：

~~~apdl
! 正确的 SI 单位制（全部用 m、N、Pa、kg）
L = 1.0                  ! m
E_val = 2.1e11           ! Pa = N/m²
force = 10000            ! N
density = 7850           ! kg/m³

! 正确的 mm 单位制（全部用 mm、N、MPa、tonne）
L = 1000                 ! mm
E_val = 2.1e5            ! MPa = N/mm²
force = 10000            ! N
density = 7.85e-9        ! tonne/mm³
~~~

建议在脚本开头用注释标注所使用的单位制，并始终使用同一套单位。

### 4. 不检查网格质量

网格质量直接影响结果精度。常见问题包括：单元长宽比过高（超过 5:1 应警惕）、壳单元翘曲严重、应力集中区域网格太粗、过渡区域单元尺寸变化太快。

~~~apdl
! 检查网格质量的方法
/PSYMB,ESYS,1            ! 显示单元坐标系
SHPP,SUMMARY             ! 壳单元质量摘要
~~~

### 5. 忽略求解器警告

求解过程中产生的警告不应被忽视。常见的警告包括：负主元（negative pivot）可能是约束不足或材料属性错误、大变形警告可能需要打开 \`NLGEOM,ON\`、条件数过大可能是材料属性差异太大或单元质量差。检查 \`.err\` 文件和 \`.out\` 文件是排查问题的基本方法。

## 调试 APDL 脚本

### 检查输出文件

ANSYS 在运行时会产生多个文件：\`.out\`（求解输出日志，包含求解信息和警告）、\`.err\`（错误和警告信息）、\`.db\`（数据库文件）、\`.rst\`（结果文件）、\`.log\`（命令日志）。

~~~apdl
! 在脚本中添加检查点
*IF,_NERR,GT,0,THEN
  *MSG,'发生 %_NERR% 个错误，请检查 .err 文件'
*ENDIF

! 使用 /OUTPUT 将输出重定向以便查看
/OUTPUT,my_analysis,out
! ... 执行分析 ...
/OUTPUT                  ! 恢复屏幕输出
~~~

### 逐步调试

对于复杂脚本，可以分段执行：先执行 \`/PREP7\` 部分检查几何和网格是否正确，再执行 \`/SOLU\` 部分检查求解是否正常，最后执行后处理检查结果是否合理。使用 \`/EOF\` 命令可以在指定位置停止脚本执行，方便分段调试。

## 进阶学习路线预览

完成本初级教程后，以下是后续进阶学习的方向概要（详见进阶系列的"APDL 进阶总结"教程）：

### 1. 非线性分析
几何非线性（\`NLGEOM,ON\`）、材料非线性（塑性 \`TB,PLASTIC\`、超弹性 \`TB,HYPER\`、蠕变 \`TB,CREEP\`）、接触非线性（\`CONTA174\` + \`TARGE170\`）。

### 2. 瞬态动力学与模态分析进阶
完全法瞬态分析（\`ANTYPE,TRANS\`）、模态叠加法、阻尼定义（\`ALPHAD\`、\`BETAD\`、\`DMPRAT\`）、响应谱分析。

### 3. 热分析与耦合场
稳态/瞬态热分析、热-结构耦合（顺序耦合和直接耦合）、压电分析。

### 4. 优化与参数研究
设计优化（\`/OPT\` 处理器）、拓扑优化（\`/TOPO\` 处理器）、参数敏感性分析、\`*DO\` 循环自动化。

### 5. APDL 二次开发
宏文件（\`.mac\`）的创建和调用、\`*CREATE\` 和 \`*USE\` 命令、APDL 与 Python 的结合（PyAnsys）。

### 6. 高级建模与分析技术
子模型技术、子结构分析（超单元法）、生死单元（\`EKILL\`/\`EALIVE\`）、接触分析、屈曲分析、APDL Math 矩阵运算。

## 学习资源推荐

1. **ANSYS 官方文档**：Help 系统中的 Analysis Guide 和 Command Reference 是最权威的参考资料。
2. **ANSYS Learning Hub**：官方在线学习平台，提供结构化的课程。
3. **ANSYS 验证手册**（Verification Manual）：包含大量标准问题的理论解与有限元解对比。
4. **APDL 命令参考手册**（Command Reference）：每个命令的完整语法和参数说明。
5. **PyAnsys 项目**：用 Python 调用 ANSYS 的开源工具集，适合批处理和自动化。

## 学习建议

第一，从简单问题开始，用理论解验证有限元结果。不要一开始就建复杂模型——先用悬臂梁、简支梁、薄板等经典问题积累经验。

第二，养成参数化建模的习惯。所有尺寸、材料属性和载荷都用参数表示，便于后续修改和优化。

第三，每次分析都做结果验证。检查力平衡、位移合理性、应力分布是否符合物理直觉。有限元结果不是"正确答案"，它只是一个近似解，精度取决于模型质量。

第四，建立自己的脚本库。把常用的建模模板、材料定义和后处理流程保存为宏文件，新项目在此基础上修改，可以大幅提高工作效率。

第五，善用 \`*GET\` 命令。它是连接分析和自动化的桥梁——自动提取最大应力、最大位移等关键指标，用于设计判断和优化迭代。

## 本节要点

APDL 的完整工作流为 /PREP7 -> /SOLU -> /POST1/POST26，每个阶段之间用 \`FINISH\` 切换。常见错误包括忘记 \`FINISH\`、单位不一致、不检查网格质量和忽略求解器警告。调试时查看 \`.err\` 和 \`.out\` 文件，分段执行脚本定位问题。进阶方向包括非线性分析、瞬态动力学、热分析、耦合场分析、优化设计和 APDL 二次开发。持续学习的最佳方式是：从经典问题出发，用理论解验证有限元结果，逐步积累参数化脚本模板。

> 📝 **相关练习**：[ex-apdl-challenge-01] 设计一个完整的工程分析方案 — 综合挑战
`,

} as const;
