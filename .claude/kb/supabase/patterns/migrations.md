# Migrations Pattern

> **Purpose**: Version-controlled database schema changes
> **MCP Validated**: 2026-02-05

## When to Use

- Initial database setup
- Schema evolution over time
- Team collaboration on database changes
- Production deployments
- Rollback scenarios

## Implementation

### CLI Migration

```bash
# Initialize Supabase project
supabase init

# Start local Supabase
supabase start

# Create new migration
supabase migration new create_invoices_table

# Apply migrations
supabase db reset

# Push to remote
supabase db push
```

### Migration File Structure

```sql
-- migrations/20240101000000_create_invoices_table.sql

-- Up migration
CREATE TABLE public.invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    vendor_name TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    invoice_date DATE NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users access own invoices"
    ON public.invoices
    FOR ALL
    USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_invoices_user_id ON public.invoices(user_id);
CREATE INDEX idx_invoices_status ON public.invoices(status);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER invoices_updated_at
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
```

## Configuration

| Command | Purpose |
|---------|---------|
| `supabase migration new <name>` | Create empty migration |
| `supabase db diff -f <name>` | Auto-generate from changes |
| `supabase db reset` | Reset local DB and apply all |
| `supabase db push` | Push to linked project |
| `supabase db pull` | Pull remote changes |

## Example Usage

```sql
-- Add column migration
ALTER TABLE public.invoices
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Create new table with foreign key
CREATE TABLE public.invoice_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backfill data
UPDATE public.invoices
SET status = 'pending'
WHERE status IS NULL;

-- Make column non-nullable after backfill
ALTER TABLE public.invoices
ALTER COLUMN status SET NOT NULL;
```

## Best Practices

1. **One change per migration** - Easier to review and rollback
2. **Idempotent SQL** - Use `IF NOT EXISTS` and `IF EXISTS`
3. **Test locally** - Always test with `supabase db reset`
4. **Backfill carefully** - Handle existing data before schema changes
5. **Document purpose** - Clear migration names and comments

## See Also

- [database.md](../concepts/database.md)
- [rls-policies.md](rls-policies.md)
