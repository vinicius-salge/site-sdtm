# RLS Policies Pattern

> **Purpose**: Secure data access with Row Level Security policies
> **MCP Validated**: 2026-02-05

## When to Use

- Multi-tenant applications where users access only their own data
- Role-based access control (admin, editor, viewer)
- Public/private content with owner access
- Team-based data sharing
- Time-based access restrictions

## Implementation

```sql
-- Base pattern: Users access only their own data
CREATE POLICY "Users access own records"
    ON public.invoices
    FOR ALL
    USING (auth.uid() = user_id);

-- Separate policies per operation
CREATE POLICY "Users can view own invoices"
    ON public.invoices
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own invoices"
    ON public.invoices
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoices"
    ON public.invoices
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own invoices"
    ON public.invoices
    FOR DELETE
    USING (auth.uid() = user_id);
```

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `FOR` | ALL | SELECT, INSERT, UPDATE, DELETE |
| `USING` | - | Condition for read operations |
| `WITH CHECK` | - | Condition for write operations |
| `TO` | public | Role this applies to |

## Example Usage

```sql
-- Admin access pattern
CREATE POLICY "Admins can access all records"
    ON public.invoices
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_id = auth.uid()
            AND role = 'admin'
        )
    );

-- Team-based access
CREATE POLICY "Team members can access team records"
    ON public.invoices
    FOR SELECT
    USING (
        team_id IN (
            SELECT team_id FROM public.team_members
            WHERE user_id = auth.uid()
        )
    );

-- Public records with owner edit
CREATE POLICY "Anyone can view published"
    ON public.posts
    FOR SELECT
    USING (status = 'published');

CREATE POLICY "Only owner can edit"
    ON public.posts
    FOR UPDATE
    USING (auth.uid() = author_id);
```

## See Also

- [database.md](../concepts/database.md)
- [auth.md](../concepts/auth.md)
- [migrations.md](migrations.md)
