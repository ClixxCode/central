'use client';

import { useState, useEffect, useCallback } from 'react';
import { Pencil, Plus, X, Check, Users, ExternalLink, LayoutGrid, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useUpdateClient } from '@/lib/hooks';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ClientWithBoards } from '@/lib/actions/clients';
import type { ClientMetadata } from '@/lib/schema';

interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

interface ClientMetadataTabProps {
  client: ClientWithBoards;
  teamMembers: TeamMember[];
  isAdmin: boolean;
}

interface LeadData {
  role: string;
  userId: string;
}

interface LinkData {
  name: string;
  url: string;
  showOnCard?: boolean;
}

function LeadEditRow({
  initial,
  teamMembers,
  onSave,
  onCancel,
}: {
  initial?: LeadData;
  teamMembers: TeamMember[];
  onSave: (lead: LeadData) => void;
  onCancel: () => void;
}) {
  const [role, setRole] = useState(initial?.role ?? '');
  const [userId, setUserId] = useState(initial?.userId ?? '');

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30">
      <Input
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="Role (e.g., Creative Director)"
        className="flex-1 h-8 text-sm"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter' && role.trim() && userId) {
            onSave({ role: role.trim(), userId });
          } else if (e.key === 'Escape') {
            onCancel();
          }
        }}
      />
      <Select value={userId} onValueChange={setUserId}>
        <SelectTrigger className="w-[200px] h-8 text-sm">
          <SelectValue placeholder="Select person" />
        </SelectTrigger>
        <SelectContent>
          {teamMembers.map((member) => (
            <SelectItem key={member.id} value={member.id}>
              <div className="flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  <AvatarImage src={member.avatarUrl ?? undefined} />
                  <AvatarFallback className="text-[10px]">
                    {(member.name ?? member.email).slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>{member.name ?? member.email}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 shrink-0"
        onClick={() => {
          if (role.trim() && userId) onSave({ role: role.trim(), userId });
        }}
        disabled={!role.trim() || !userId}
      >
        <Check className="h-4 w-4 text-green-600" />
      </Button>
      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onCancel}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

function LinkEditRow({
  initial,
  onSave,
  onCancel,
}: {
  initial?: LinkData;
  onSave: (link: LinkData) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [url, setUrl] = useState(initial?.url ?? '');
  const [showOnCard, setShowOnCard] = useState(initial?.showOnCard ?? false);

  return (
    <div className="flex flex-col gap-2 py-2 px-3 rounded-lg bg-muted/30">
      <div className="flex items-center gap-3">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Link name"
          className="flex-1 h-8 text-sm"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Escape') onCancel();
          }}
        />
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://..."
          className="flex-1 h-8 text-sm"
          type="url"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && name.trim() && url.trim()) {
              onSave({ name: name.trim(), url: url.trim(), showOnCard });
            } else if (e.key === 'Escape') {
              onCancel();
            }
          }}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          onClick={() => {
            if (name.trim() && url.trim()) onSave({ name: name.trim(), url: url.trim(), showOnCard });
          }}
          disabled={!name.trim() || !url.trim()}
        >
          <Check className="h-4 w-4 text-green-600" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none pl-1">
        <input
          type="checkbox"
          checked={showOnCard}
          onChange={(e) => setShowOnCard(e.target.checked)}
          className="rounded border-muted-foreground/50"
        />
        Show on client card
      </label>
    </div>
  );
}

export function ClientMetadataTab({ client, teamMembers, isAdmin }: ClientMetadataTabProps) {
  const updateClient = useUpdateClient();

  const [leads, setLeads] = useState<LeadData[]>(client.metadata?.leads ?? []);
  const [links, setLinks] = useState<LinkData[]>(client.metadata?.links ?? []);
  const [editingLeads, setEditingLeads] = useState(false);
  const [editingLeadIndex, setEditingLeadIndex] = useState<number | null>(null);
  const [isAddingLead, setIsAddingLead] = useState(false);
  const [editingLinks, setEditingLinks] = useState(false);
  const [editingLinkIndex, setEditingLinkIndex] = useState<number | null>(null);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [slackChannelUrl, setSlackChannelUrl] = useState(client.metadata?.slackChannelUrl ?? '');
  const [editingSlack, setEditingSlack] = useState(false);

  useEffect(() => {
    setLeads(client.metadata?.leads ?? []);
    setLinks(client.metadata?.links ?? []);
    setEditingLeads(false);
    setEditingLeadIndex(null);
    setIsAddingLead(false);
    setEditingLinks(false);
    setEditingLinkIndex(null);
    setIsAddingLink(false);
    setSlackChannelUrl(client.metadata?.slackChannelUrl ?? '');
    setEditingSlack(false);
  }, [client]);

  const persist = useCallback(
    (newLeads: LeadData[], newLinks: LinkData[]) => {
      updateClient.mutate(
        {
          id: client.id,
          input: {
            metadata: {
              ...client.metadata,
              leads: newLeads,
              links: newLinks,
            },
          },
        },
        {
          onError: () => {
            toast.error('Failed to save changes');
          },
        }
      );
    },
    [client.id, client.metadata, updateClient]
  );

  const handleSaveLead = (index: number | null, lead: LeadData) => {
    const newLeads =
      index !== null
        ? leads.map((l, i) => (i === index ? lead : l))
        : [...leads, lead];
    setLeads(newLeads);
    setEditingLeadIndex(null);
    setIsAddingLead(false);
    persist(newLeads, links);
  };

  const handleDeleteLead = (index: number) => {
    const newLeads = leads.filter((_, i) => i !== index);
    setLeads(newLeads);
    persist(newLeads, links);
  };

  const handleSaveLink = (index: number | null, link: LinkData) => {
    const newLinks =
      index !== null
        ? links.map((l, i) => (i === index ? link : l))
        : [...links, link];
    setLinks(newLinks);
    setEditingLinkIndex(null);
    setIsAddingLink(false);
    persist(leads, newLinks);
  };

  const handleDeleteLink = (index: number) => {
    const newLinks = links.filter((_, i) => i !== index);
    setLinks(newLinks);
    persist(leads, newLinks);
  };

  const handleSaveSlackChannel = (url: string) => {
    const trimmed = url.trim();
    setSlackChannelUrl(trimmed);
    setEditingSlack(false);
    updateClient.mutate(
      {
        id: client.id,
        input: {
          metadata: {
            ...client.metadata,
            slackChannelUrl: trimmed || undefined,
          },
        },
      },
      {
        onError: () => {
          toast.error('Failed to save Slack channel');
          setSlackChannelUrl(client.metadata?.slackChannelUrl ?? '');
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Account Leads */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Account Leads
          </CardTitle>
          {isAdmin && (
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (editingLeads) {
                    setEditingLeads(false);
                    setEditingLeadIndex(null);
                    setIsAddingLead(false);
                  } else {
                    setEditingLeads(true);
                  }
                }}
              >
                {editingLeads ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Done
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4 mr-1" />
                    Add / Edit Leads
                  </>
                )}
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {leads.map((lead, index) => {
              const member = teamMembers.find((m) => m.id === lead.userId);

              if (editingLeads && editingLeadIndex === index) {
                return (
                  <LeadEditRow
                    key={index}
                    initial={lead}
                    teamMembers={teamMembers}
                    onSave={(updated) => handleSaveLead(index, updated)}
                    onCancel={() => setEditingLeadIndex(null)}
                  />
                );
              }

              return (
                <div
                  key={index}
                  className={cn(
                    'group/row flex items-center justify-between py-2 px-3 rounded-lg',
                    editingLeads && 'cursor-pointer hover:bg-muted/50'
                  )}
                  onClick={() => editingLeads && setEditingLeadIndex(index)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={member?.avatarUrl ?? undefined} />
                      <AvatarFallback>
                        {(member?.name ?? member?.email ?? '??').slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">
                        {member?.name ?? member?.email ?? 'Unknown user'}
                      </p>
                      <p className="text-xs text-muted-foreground">{lead.role}</p>
                    </div>
                  </div>
                  {editingLeads && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover/row:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteLead(index);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}

            {editingLeads && isAddingLead && (
              <LeadEditRow
                teamMembers={teamMembers}
                onSave={(lead) => handleSaveLead(null, lead)}
                onCancel={() => setIsAddingLead(false)}
              />
            )}

            {editingLeads && !isAddingLead && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1"
                onClick={() => {
                  setIsAddingLead(true);
                  setEditingLeadIndex(null);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Lead
              </Button>
            )}

            {leads.length === 0 && !editingLeads && (
              <p className="text-sm text-muted-foreground py-2">No leads assigned.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Account Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ExternalLink className="h-4 w-4" />
            Account Links
          </CardTitle>
          {isAdmin && (
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (editingLinks) {
                    setEditingLinks(false);
                    setEditingLinkIndex(null);
                    setIsAddingLink(false);
                  } else {
                    setEditingLinks(true);
                  }
                }}
              >
                {editingLinks ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Done
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4 mr-1" />
                    Add / Edit Links
                  </>
                )}
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {links.map((link, index) => {
              if (editingLinks && editingLinkIndex === index) {
                return (
                  <LinkEditRow
                    key={index}
                    initial={link}
                    onSave={(updated) => handleSaveLink(index, updated)}
                    onCancel={() => setEditingLinkIndex(null)}
                  />
                );
              }

              return (
                <div
                  key={index}
                  className={cn(
                    'group/row flex items-center justify-between py-2 px-3 rounded-lg',
                    editingLinks && 'cursor-pointer hover:bg-muted/50'
                  )}
                  onClick={() => editingLinks && setEditingLinkIndex(index)}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium">{link.name}</p>
                        {link.showOnCard && (
                          <LayoutGrid className="h-3 w-3 text-muted-foreground" />
                        )}
                      </div>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:text-primary/80 hover:underline truncate block"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {link.url}
                      </a>
                    </div>
                  </div>
                  {editingLinks && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover/row:opacity-100 shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteLink(index);
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}

            {editingLinks && isAddingLink && (
              <LinkEditRow
                onSave={(link) => handleSaveLink(null, link)}
                onCancel={() => setIsAddingLink(false)}
              />
            )}

            {editingLinks && !isAddingLink && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1"
                onClick={() => {
                  setIsAddingLink(true);
                  setEditingLinkIndex(null);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add Link
              </Button>
            )}

            {links.length === 0 && !editingLinks && (
              <p className="text-sm text-muted-foreground py-2">No links added.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Slack Channel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Hash className="h-4 w-4" />
            Slack Channel
          </CardTitle>
          {isAdmin && !editingSlack && (
            <CardAction>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingSlack(true)}
              >
                <Pencil className="h-4 w-4 mr-1" />
                {slackChannelUrl ? 'Edit' : 'Add'}
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent>
          {editingSlack ? (
            <div className="flex items-center gap-3 py-2 px-3 rounded-lg bg-muted/30">
              <Input
                value={slackChannelUrl}
                onChange={(e) => setSlackChannelUrl(e.target.value)}
                placeholder="Paste Slack channel URL"
                className="flex-1 h-8 text-sm"
                type="url"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSaveSlackChannel(slackChannelUrl);
                  } else if (e.key === 'Escape') {
                    setSlackChannelUrl(client.metadata?.slackChannelUrl ?? '');
                    setEditingSlack(false);
                  }
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={() => handleSaveSlackChannel(slackChannelUrl)}
              >
                <Check className="h-4 w-4 text-green-600" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={() => {
                  setSlackChannelUrl(client.metadata?.slackChannelUrl ?? '');
                  setEditingSlack(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : slackChannelUrl ? (
            <div className="flex items-center gap-2 py-2 px-3">
              <Hash className="h-4 w-4 text-muted-foreground shrink-0" />
              <a
                href={slackChannelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:text-primary/80 hover:underline truncate"
              >
                {slackChannelUrl}
              </a>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              No Slack channel configured.
            </p>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
