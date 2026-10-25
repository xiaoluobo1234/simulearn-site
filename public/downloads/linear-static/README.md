# 线性静力：三个独立教学有限元案例包

> AI 辅助编写，待本人复核；用户本机待复现。用于教育与初步核查，未运行 ANSYS 或在线 CAE，不是作者工程经历或安全认证。

## 包内容

每个 ZIP 根目录恰好四个文件：input.json、verify.py、reference-results.json、README.md。解压到独立文件夹即可运行，三个包的 verify.py 与本目录单一源码逐字一致。SHA256SUMS.txt 列出公开文件与 ZIP 的 SHA-256（清单本身除外）。

| 包 | 位移/mm（有符号） | 支承反力/N | 应变能/N·mm |
| --- | ---: | ---: | ---: |
| uniform-bar.zip | 0.4761904761905 | -10000.00000000 | 2380.952380952 |
| stepped-bar.zip | 0.7619047619048 | -10000.00000000 | 3809.523809524 |
| cantilever-beam.zip | -0.1904761904762 | 1000.000000000 | 95.23809523809 |

阶梯杆仅有端部 +10000 N，无界面集中外力；梁向上为正，端部力 −1000 N。梁的固端反力矩约 +1000000 N·mm。反力是支承作用于结构的力，N·mm/1000=J。

## 实际执行证据

执行者：Codex AI执行环境中的Python参考计算；解释器 CPython 3.13.14；环境 Windows-11-10.0.26200-SP0；执行时间 2026-10-25T12:13:41+08:00（Asia/Shanghai）。各包 reference-results.json 分别保存实际执行时间、原输入 SHA-256、完整 K/F/位移/反力、逐单元能量、解析对照和残差。顶层 reference-results.json 汇总三份原输出，不替换其时间与版本。

本轮还实际比较每段/整梁 1、2、4、8、16、32、64 单元，三类目标量均通过脚本的解析与平衡自检。该检查不表示用户本机复现、商业软件运行或一般三维网格收敛。

## 本机复现

Python 3.10+，仅使用标准库，无网络请求：

~~~sh
# 解压任意一个案例后，在该文件夹运行
python verify.py
python verify.py --output my-results.json --executor "我在本机的 Python 环境"
# 或使用顶层单源码指定一个输入
python verify.py --input stepped-bar/input.json
~~~

默认只打印结果；--output 会覆盖指定输出，请另取名字留存自己的执行证据。程序拒绝覆盖输入或脚本。新运行不会自动把执行者标为 Codex；不使用 Python assert 作为必须启用的唯一校验，优化模式也保留显式数值检查。坏输入失败退出且不输出伪造的成功结果。

## 假设与计算过程

杆使用两节点轴向单元，梁使用 [v,theta] 两节点 Hermite 弯曲单元。均为小位移线弹性、无分布载荷/自重/惯性；先实际组装 K，再对已知位移分区求解，随后用原矩阵 R=Ku−F 恢复反力，并比较整体/逐单元应变能与独立解析式。梁平移力残差以 N、转动力矩残差以 N·mm 分开记录，不把两者直接相加。

均匀端拉杆的位移为一次函数，阶梯杆为分段一次函数；本悬臂梁位移为三次函数，所选插值能表达它们。因此多网格一致是本特例的组装与边界核查，不能证明未知模型的应力、局部连接或三维网格已收敛。

Euler–Bernoulli 梁忽略剪切变形；此处截面100×100 mm、长1000 mm。含剪切的 Timoshenko 或实体模型可能与该解析理想化有系统差异。网站0.5%相对容差加微小绝对容差仅作相同假设下的教学反馈，不是任何软件/真实结构的统一验收标准。

## 原始来源与实际读取范围

- MIT Roylance, Finite Element Analysis：实际核对印刷第3–6页杆伸长、单元矩阵、组装和约束处理，未读全文：https://ocw.mit.edu/courses/3-11-mechanics-of-materials-fall-1999/812a432c72099369788f78fb344eb047_MIT3_11F99_fea.pdf
- MIT1.050 Chapter10：实际核对PDF第20–24页梁单元刚度构造、弯曲系数及组装说明；本包仅取弯曲子块并声明自己的正方向：https://ocw.mit.edu/courses/1-050-solid-mechanics-fall-2004/f9a4d5764b9b0f51ffaacbdf69f7aed8_emech10_04.pdf
- MIT2.002 Lecture2：实际读取PDF第7页悬臂端载、固端位移/转角与平衡说明；本包参数和数值由独立解析式核算：https://ocw.mit.edu/courses/2-002-mechanics-and-materials-ii-spring-2004/bc25a56b5a91ad29ca5c7419616686f7_lec2.pdf

本包为原创教学实现，无教材图像或长段转载；只引用实际读取的有限范围，不宣称完整课程学习或 CAE 端到端验证。
