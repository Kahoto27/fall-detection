'use client'

import { useState } from 'react'
import { Phone, Plus, Trash2, UserRound } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import type { SmsContact } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

interface Props {
  contacts: SmsContact[]
  onToggle: (id: string) => void
  onRemove: (id: string) => void
  onAdd: (c: Omit<SmsContact, 'id' | 'priority' | 'active'>) => void
}

export function SmsContacts({ contacts, onToggle, onRemove, onAdd }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [relation, setRelation] = useState('')
  const [phone, setPhone] = useState('')

  const submit = () => {
    if (!name.trim() || !phone.trim()) return
    onAdd({ name: name.trim(), relation: relation.trim() || 'Khác', phone: phone.trim() })
    setName('')
    setRelation('')
    setPhone('')
    setOpen(false)
  }

  const inputCls =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {contacts.filter((c) => c.active).length} liên hệ đang nhận cảnh báo
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button size="sm" />}>
            <Plus className="size-4" /> Thêm liên hệ
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Thêm liên hệ nhận SMS</DialogTitle>
              <DialogDescription>
                Người này sẽ nhận tin nhắn khi hệ thống phát hiện té ngã.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="c-name">
                  Họ tên
                </label>
                <input
                  id="c-name"
                  className={inputCls}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nguyễn Văn A"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="c-rel">
                  Quan hệ
                </label>
                <input
                  id="c-rel"
                  className={inputCls}
                  value={relation}
                  onChange={(e) => setRelation(e.target.value)}
                  placeholder="Con trai / Y tế / Hàng xóm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="c-phone">
                  Số điện thoại
                </label>
                <input
                  id="c-phone"
                  className={inputCls}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+84 9xx xxx xxx"
                  inputMode="tel"
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="ghost" />}>
                Huỷ
              </DialogClose>
              <Button onClick={submit}>Lưu liên hệ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <ul className="space-y-2">
        {contacts.map((c) => (
          <li
            key={c.id}
            className={cn(
              'flex items-center gap-3 rounded-lg border p-3',
              !c.active && 'opacity-60',
            )}
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
              <UserRound className="size-5 text-muted-foreground" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium">{c.name}</p>
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {c.relation}
                </Badge>
              </div>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="size-3.5" /> {c.phone}
              </p>
            </div>
            <Switch
              checked={c.active}
              onCheckedChange={() => onToggle(c.id)}
              aria-label={`Bật/tắt cảnh báo cho ${c.name}`}
            />
            <Button
              size="icon"
              variant="ghost"
              className="size-8 text-muted-foreground hover:text-destructive"
              onClick={() => onRemove(c.id)}
              aria-label={`Xoá ${c.name}`}
            >
              <Trash2 className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
