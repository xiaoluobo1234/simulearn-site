# 线性静力代码练习：反力恢复与应变能

> 标准库离线练习，AI 辅助编写，待本人复核。默认脚手架明确未完成；参考答案通过不表示学员已完成、本机已复现或 CAE 验证通过。

## 文件与目标

- exercise.py：两个 TODO 函数，原始下载状态均抛 NotImplementedError，供自己编写。
- run_tests.py：Python 3.10+ 标准库 unittest；四组十项检查，每次显示 expected、actual 和单位。
- fixtures.json：五个可读测试输入，所有自由度都是平移，K 用 N/mm、u 用 mm、F 用 N。
- reference_solution.py：明确标注的参考答案，只有显式选择才用于检查；不要把它当作自己的练习成果。
- reference-check-results.json：本次参考实现、默认脚手架及六种刻意错误实现的实际执行记录。
- PACKAGE-SHA256SUMS.txt：ZIP 内六个内容文件的 SHA-256；外层 SHA256SUMS.txt 另覆盖 ZIP 等分发文件，清单本身除外。

本练习只做已给定矩阵和向量的后处理运算，不组装或求解有限元模型、不运行 ANSYS、不联网、不上传代码，也不改变网站学习状态。使用前确认本地代码来源；--implementation 执行所选本地 Python 文件，不提供隔离沙箱。

## 两个函数的约定

1. recover_reaction(K,u,F,support_dof)：返回原矩阵 R=Ku−F 在支承自由度处的有符号反力，单位 N。即使支承节点本身有外载，也必须减去 F。反力定义为支承作用于结构的力，不取绝对值。
2. strain_energy(K,u)：返回 U=0.5*uᵀKu，单位 N·mm；包含非对角项，保留 0.5，不自动除以 1000。负位移可以产生正能量，零位移得到零能量。

K 必须是原始、尚未替换约束行的对称刚度矩阵，向量尺寸相容，support_dof 为零起始索引；不要修改传入数据。本练习未覆盖梁的转动自由度及混合力/力矩单位。

## 本机操作

解压 ZIP 到独立文件夹，使用 Python 3.10+：

~~~sh
python run_tests.py
~~~

原始脚手架会显示 TODO unfinished 和 NotImplementedError，并以状态 1 退出。这表示练习尚未实现，属于正常起点，不是 CAE 求解失败。编辑 exercise.py 后重复执行，比较每项 expected 与 actual。

想单独核对参考答案时明确选择：

~~~sh
python run_tests.py --implementation reference_solution.py
~~~

若选择自建实现，相对路径按命令当前工作目录解析。可以把自己的运行输出留在本地，再手动将实际环境、命令和日志位置填写进网站练习证据：

~~~sh
python run_tests.py --implementation exercise.py > my-code-practice.log 2>&1
~~~

重定向会创建或覆盖同名日志，请另取文件名。运行器本身只输出结果，不会修改 exercise.py、参考实现、fixtures 或网站记录。状态 0 只表示这十项检查通过；状态 1 表示测试未通过或 TODO 未完成；状态 2 表示运行器或实现文件无法正常加载。数值检查采用 unittest 方法，Python 优化模式不会关闭这些测试。

## 五个测试输入与四组检查

| fixture | 重点 | 反力 / N | 能量 / N·mm |
| --- | --- | ---: | ---: |
| standard-bar | 原刚度矩阵、正向端拉 | -10000 | 2380.9523809523807 |
| loaded-support | 支承处另有 +500 N 外载，不能漏减 F | -10500 | 2380.9523809523807 |
| reverse-load | 反向端力、负位移，反力转正且能量仍正 | +10000 | 2380.9523809523807 |
| zero-motion | 零位移与零外载 | 0 | 0 |
| coupled-matrix | K=[[4,-1],[-1,3]],u=[2,-1],F=[1,2],support_dof=1 | -7 | 11.5 |

四组为：原矩阵有符号反力及支承外载、完整非对角能量、零位移、N·mm 单位。coupled-matrix 是单独的代数后处理输入，不宣称给定 u 和 F 已组成求解收敛的平衡工况。

## 实际参考执行与区分度

执行者：Codex AI执行环境中的Python参考实现检查；解释器 CPython 3.13.14；系统 Windows-11-10.0.26200-SP0；时间 2026-10-25T12:29:41+08:00（Asia/Shanghai）。

实际结果：参考实现十项通过；默认未完成脚手架十项因 NotImplementedError 未通过；六种刻意错误实现均被至少一项检查检出。详细 expected/actual 和真实汇总见 reference-check-results.json。该文件只保存比较行及汇总，不保存临时路径的完整堆栈；本机重跑可看到完整输出。

错误对照包括：漏减外载、对反力取绝对值、反力符号反转、能量漏 0.5、能量只用对角项、把 N·mm 自动除以 1000 变成 J。有限样例不能排除所有错误；通过它们不代表一般矩阵算法、工程模型或个人能力已经完成验证。

代码单测的微小舍入容差仅核对这些给定数组，与网页数值练习的 0.5% 教学匹配范围是不同规则，都不是工程验收阈值。

## 来源与适用边界

公式来自线弹性离散平衡 R=Ku−F 与储能 U=uᵀKu/2；为本项目原创代码练习，不复制教材长文或图。原始依据沿用本轮实际读取的 MIT Roylance《Finite Element Analysis》印刷第3–6页的单元关系、组装与约束方程；非对角矩阵测试为自设代数核对，不声称该讲义给出同一数组：
https://ocw.mit.edu/courses/3-11-mechanics-of-materials-fall-1999/812a432c72099369788f78fb344eb047_MIT3_11F99_fea.pdf

支承恢复使用原方程，未将替换的约束方程当作反力。应变能只用于本页的无初始应变线弹性刚度模型；热载荷、非线性耗散、动力项和含转角的混合单位需另行建模与测试。参考实现运行证据与本人运行、网站数值答题、ANSYS 和 CAE 任务分别管理。
