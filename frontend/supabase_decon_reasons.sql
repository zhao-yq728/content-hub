-- 为 deconstructions 表增加 gene_reasons 字段，用于存储六大爆款基因每条的具体原因
ALTER TABLE deconstructions ADD COLUMN IF NOT EXISTS gene_reasons JSONB DEFAULT '{}';
