# SimuLearn PDF 整书入库服务

本目录的常驻服务从 R2 领取 PDF 任务，完成元数据预检、MinerU 解析、图片发布、独立导读/摘要、Dify 按章入库和阅读数据生成。

安全边界：

- R2 是任务和结果的持久化来源。
- Redis 只使用 DB 15 和 `simulearn:books:*` 前缀做锁与短期状态，不写 Dify/Celery 队列。
- `source.md` 始终是 MinerU 原始输出；只有展示副本的本地图片链接会替换成 R2 代理 URL。
- 新版发布成功后才清理旧文件，解析失败不会切断在线旧版本。

完整步骤见 [`docs/PDF-BOOK-INGESTION.md`](../../docs/PDF-BOOK-INGESTION.md)。

语法检查：

```bash
python -m py_compile book_worker.py
```
