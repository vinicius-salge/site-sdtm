# Sistema de Número de Inscrição - Instruções

## O que foi implementado

O sistema agora gera automaticamente um número único de inscrição para cada associado cadastrado.

### Formato do número
- **Padrão**: `SDTM-001000`, `SDTM-001001`, etc.
- **Prefixo**: Configurável na tabela `configuracoes`
- **Sequência**: Inicia em 1000 e incrementa automaticamente

## Arquivos modificados/criados

### Banco de Dados
- `sql/schema.sql` - Atualizado com nova estrutura
- `sql/migrate-inscricao.js` - Script de migração específico

### API
- `api/inscricao/proximo.js` - Endpoint para gerar próximo número
- `api/auth/register.js` - Atualizado para salvar número no cadastro

### Frontend
- `cadastro.html` - Campo de inscrição agora é automático e não editável

### Validação
- `lib/validators.js` - Adicionado campo numeroInscricao ao schema

## Como executar a migração

### 1. Configurar variáveis de ambiente
Certifique-se de que o arquivo `.env` está configurado com:
```
DATABASE_URL=sua_url_do_banco_postgresql
```

### 2. Executar a migração
```bash
npm run db:migrate:inscricao
```

Ou diretamente:
```bash
node sql/migrate-inscricao.js
```

### 3. Verificar se funcionou
A migração deve exibir:
```
✓ Sequencia seq_numero_inscricao criada
✓ Tabela configuracoes criada
✓ Prefixo padrao inserido
✓ Coluna numero_inscricao adicionada na tabela users
✓ Indice idx_users_numero_inscricao criado

✅ Migration de inscricao executada com sucesso!
```

## Funcionamento

1. Quando um usuário acessa a página de cadastro, o sistema busca automaticamente o próximo número disponível via API
2. O número é exibido no formulário como somente leitura
3. Ao finalizar o cadastro, o número é salvo no banco de dados associado ao usuário
4. O número também aparece no PDF da ficha cadastral

## Alterar o prefixo

Se quiser mudar o prefixo (ex: de "SDTM" para "SDTM-MG"):

```sql
UPDATE configuracoes 
SET valor = 'SDTM-MG' 
WHERE chave = 'prefixo_inscricao';
```

## Ver números já atribuídos

```sql
SELECT username, email, numero_inscricao, created_at 
FROM users 
WHERE numero_inscricao IS NOT NULL 
ORDER BY numero_inscricao;
```
