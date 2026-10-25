# 网格数据比较：变截面杆示例

variable-bar.csv 仅从既有 mechanics-foundations/reference-results.json 提取 h=element_length_mm 与 value=tip_mm，没有产生新的求解记录。

- 目标量：变截面杆端部轴向位移；value 单位 mm；h 单位 mm。
- 小应变、线弹性一维轴杆，A(x)=100(1+x/1000) mm²，E=210000 N/mm²、P=10000 N、L=1000 mm，左端轴向固定。
- 五档 N=1、2、4、8、16；h=L/N；有限元逐档实际组装并求解。
- 解析参考：PL ln(2)/(EA0)=0.3300700859809263 mm。
- 原执行者：Codex AI执行环境中的Python参考计算；CPython 3.12.14；2026-10-24T02:27:18+08:00（Asia/Shanghai）。这不是用户本机、ANSYS 或在线 CAE 运行证据。

完整原输出：[reference-results.json](/downloads/mechanics-foundations/reference-results.json)；计算脚本：[verify_basics.py](/downloads/mechanics-foundations/verify_basics.py)；模型、执行环境与原运行命令：[原复现说明](/downloads/mechanics-foundations/README.md)。下载后可在自己的 Python 3.10+ 环境按原说明运行；新的结果和执行者必须如实记录。

## 指标定义

先按 h 从大到小排列。相邻绝对变化为 abs(value_finer-value_coarser)，相邻相对变化分母为 abs(value_finer)，细档为零则不可计算。它们不是对解析解的误差。

有可靠解析参考时，绝对误差为 abs(value-reference)；只有 reference 非零才计算相对误差 abs(value-reference)/abs(reference)。输出 JSON 的比值是无量纲小数，页面显示为百分数。首档无相邻变化；超出浮点范围的差值或比值不可计算，不当作零。

工具不转换或猜测单位，不给通用百分比阈值，不估计误差阶，也不自动宣布已经收敛或工程可信。用户应核对一致模型、载荷、支承、材料、求解设置及目标量提取位置。若应力热点随网格细化持续增大，应另查局部奇异性及评价目标。

方法思路参考 [DOLFINx 官方误差控制章节](https://jsdokken.com/dolfinx-tutorial/chapter4/convergence.html) 的制造解与误差范数说明；本工具没有运行 DOLFINx、验证其全部实现或复制其计算结果。数据来自本仓库已有一维杆参考脚本。
