# 两段阶梯杆端拉：独立教学案例包

> AI 辅助编写，待本人复核；用户本机待复现。本包不是 ANSYS 结果或工程经历。

## 输入与模型

完整输入、单位和网格数见 input.json。只有轴向位移自由度；各段内 EA 为常数，界面共享节点；无弯曲、重力、体力或惯性。

端位移 = u0 + P*sum(Li/(E*Ai))，反力 = -P，应变能 = P²*sum(Li/(E*Ai))/2。 反力表示支承作用于结构的力。N·mm 除以 1000 才是 J。

## 运行

解压四个文件到同一目录，使用 Python 3.10+ 标准库：

~~~sh
python verify.py
python verify.py --output my-results.json --executor "我在本机的 Python 环境"
~~~

默认向终端输出，不覆盖已保存参考。--output 会写入或覆盖指定文件，请另取文件名；程序拒绝覆盖脚本和输入。新执行者默认未声明，不会冒充 Codex。

## 验证范围

脚本实际组装单元矩阵、分区求解、用原矩阵恢复反力并计算能量，再独立比较解析式。reference-results.json 保存原执行环境、输入 SHA-256、位移、反力、能量与残差。多个网格在此特例中一致，是插值可表达该解的组装检查，不能推广为三维网格收敛或局部应力已准确。

可修改 elements 比较网格，每段必须为 1–64 的整数；不自动换算单位。坏输入会失败退出，不能把失败解释为仿真完成。

## 原始依据

杆的单元矩阵与组装：MIT Roylance, Finite Element Analysis，实际核对印刷第3–6页：https://ocw.mit.edu/courses/3-11-mechanics-of-materials-fall-1999/812a432c72099369788f78fb344eb047_MIT3_11F99_fea.pdf

梁的单位位移刚度构造：MIT 1.050 Chapter10，实际核对PDF第20–24页相关段落：https://ocw.mit.edu/courses/1-050-solid-mechanics-fall-2004/f9a4d5764b9b0f51ffaacbdf69f7aed8_emech10_04.pdf

本包参数、实现和解析交叉核验为原创教学参考，未声称读完全部讲义或启动 CAE 工作台。

相对输出路径按运行命令时的工作目录解析。默认只向终端输出；显式校验失败以非零状态退出且不写成功结果，已有输出不被失败结果覆盖。这些检查使用显式异常，Python -O 也不会关闭它们。
