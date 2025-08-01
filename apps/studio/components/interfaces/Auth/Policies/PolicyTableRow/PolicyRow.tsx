import type { PostgresPolicy } from '@supabase/postgres-meta'
import { PermissionAction } from '@supabase/shared-types/out/constants'
import { noop } from 'lodash'
import { Edit, MoreVertical, Trash } from 'lucide-react'

import { useProjectContext } from 'components/layouts/ProjectLayout/ProjectContext'
import { DropdownMenuItemTooltip } from 'components/ui/DropdownMenuItemTooltip'
import Panel from 'components/ui/Panel'
import { useAuthConfigQuery } from 'data/auth/auth-config-query'
import { useCheckPermissions } from 'hooks/misc/useCheckPermissions'
import { useAiAssistantStateSnapshot } from 'state/ai-assistant-state'
import {
  Badge,
  Button,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from 'ui'
import { generatePolicyUpdateSQL } from './PolicyTableRow.utils'

interface PolicyRowProps {
  policy: PostgresPolicy
  onSelectEditPolicy: (policy: PostgresPolicy) => void
  onSelectDeletePolicy: (policy: PostgresPolicy) => void
  isLocked: boolean
}

const PolicyRow = ({
  policy,
  isLocked: isLockedDefault,
  onSelectEditPolicy = noop,
  onSelectDeletePolicy = noop,
}: PolicyRowProps) => {
  const aiSnap = useAiAssistantStateSnapshot()
  const canUpdatePolicies = useCheckPermissions(PermissionAction.TENANT_SQL_ADMIN_WRITE, 'policies')

  const { project } = useProjectContext()
  const { data: authConfig } = useAuthConfigQuery({ projectRef: project?.ref })

  // override islocked for Realtime messages table
  const isLocked =
    policy.schema === 'realtime' && policy.table === 'messages' ? false : isLockedDefault

  // TODO(km): Simple check for roles that allow authenticated access.
  // In the future, we'll use splinter to return proper warnings for policies that allow anonymous user access.
  const appliesToAnonymousUsers =
    authConfig?.EXTERNAL_ANONYMOUS_USERS_ENABLED &&
    (policy.roles.includes('authenticated') || policy.roles.includes('public'))

  return (
    <Panel.Content
      className={cn(
        'flex border-overlay',
        'w-full last:border-0 space-x-4 border-b py-4 lg:items-center'
      )}
    >
      <div className="flex grow flex-col gap-y-1">
        <div className="flex items-start gap-x-4">
          <p className="font-mono text-xs text-foreground-light translate-y-[2px] min-w-12">
            {policy.command}
          </p>

          <div className="flex flex-col gap-y-1">
            <Button
              type="text"
              className="h-auto text-foreground text-sm border-none p-0 hover:bg-transparent justify-start"
              onClick={() => onSelectEditPolicy(policy)}
            >
              {policy.name}
            </Button>
            <div className="flex items-center gap-x-1">
              <div className="text-foreground-lighter text-sm">
                Applied to:{' '}
                {policy.roles.slice(0, 3).map((role, i) => (
                  <span key={`policy-${role}-${i}`}>
                    <code className="text-foreground-light text-xs">{role}</code>
                    {i < Math.min(policy.roles.length, 3) - 1 ? ', ' : ' '}
                  </span>
                ))}
                {policy.roles.length > 1 ? 'roles' : 'role'}
              </div>
              {policy.roles.length > 3 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <code key="policy-etc" className="text-foreground-light text-xs">
                      + {policy.roles.length - 3} more roles
                    </code>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="center">
                    {policy.roles.slice(3).join(', ')}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {appliesToAnonymousUsers ? (
            <Badge color="yellow">Applies to anonymous users</Badge>
          ) : null}
        </div>
      </div>
      <div>
        {!isLocked && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="default" className="px-1.5" icon={<MoreVertical />} />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="end" className="w-52">
              <DropdownMenuItem className="gap-x-2" onClick={() => onSelectEditPolicy(policy)}>
                <Edit size={14} />
                <p>Edit policy</p>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="space-x-2"
                onClick={() => {
                  const sql = generatePolicyUpdateSQL(policy)
                  aiSnap.newChat({
                    name: `Update policy ${policy.name}`,
                    open: true,
                    sqlSnippets: [sql],
                    initialInput: `Update the policy with name "${policy.name}" in the ${policy.schema} schema on the ${policy.table} table. It should...`,
                    suggestions: {
                      title: `I can help you make a change to the policy "${policy.name}" in the ${policy.schema} schema on the ${policy.table} table, here are a few example prompts to get you started:`,
                      prompts: [
                        'Tell me how I can improve this policy...',
                        'Duplicate this policy for another table...',
                        'Add extra conditions to this policy...',
                      ],
                    },
                  })
                }}
              >
                <Edit size={14} />
                <p>Edit policy with Assistant</p>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItemTooltip
                className="gap-x-2"
                disabled={!canUpdatePolicies}
                onClick={() => onSelectDeletePolicy(policy)}
                tooltip={{
                  content: {
                    side: 'left',
                    text: 'You need additional permissions to delete policies',
                  },
                }}
              >
                <Trash size={14} />
                <p>Delete policy</p>
              </DropdownMenuItemTooltip>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </Panel.Content>
  )
}

export default PolicyRow
