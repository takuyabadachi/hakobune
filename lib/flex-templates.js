/**
 * Flex Message Templates for LINE
 * Rich card/carousel layouts for in-LINE data display
 */

/**
 * Help menu — shows all available commands
 */
export function helpFlex() {
  return {
    type: 'flex',
    altText: 'Hakobune AI — 使い方ガイド',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '🚢 Hakobune AI', weight: 'bold', size: 'lg', color: '#1d1d1f' },
          { type: 'text', text: '業務アシスタント ガイド', size: 'xs', color: '#86868b', margin: 'sm' },
        ],
        backgroundColor: '#f5f5f7',
        paddingAll: '16px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          sectionTitle('✍️ 文章作成'),
          cmdRow('そのまま送信', '対外連絡文を作成'),
          separator(),
          sectionTitle('📋 情報整理'),
          cmdRow('#議事録', 'メモ → 構造化議事録'),
          cmdRow('#整理', '散在情報の要約'),
          separator(),
          sectionTitle('📐 テンプレート'),
          cmdRow('#テンプレ', 'マニュアル・指示書'),
          cmdRow('#経理', '税理士への質問文'),
          cmdRow('#SNS', '投稿文作成'),
          separator(),
          sectionTitle('🔍 検索・管理'),
          cmdRow('#振り返り', '過去の会話検索'),
          separator(),
          sectionTitle('⚙️ その他'),
          cmdRow('#reset', '会話リセット'),
          cmdRow('#記録停止', '発言記録を停止'),
          cmdRow('#記録再開', '発言記録を再開'),
        ],
        paddingAll: '16px',
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        contents: [
          {
            type: 'text',
            text: '💡 戦略・企画・分析はCOptO AIへ',
            size: 'xxs',
            color: '#86868b',
            align: 'center',
          },
        ],
        paddingAll: '12px',
        backgroundColor: '#f5f5f7',
      },
    },
  };
}

/**
 * Privacy notice — shown when bot joins a group
 */
export function privacyNoticeFlex() {
  return {
    type: 'flex',
    altText: 'Hakobune AI — ご案内',
    contents: {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: '🚢 Hakobune AI', weight: 'bold', size: 'md' },
          { type: 'text', text: 'グループに参加しました', size: 'sm', color: '#86868b' },
          { type: 'separator', margin: 'md' },
          {
            type: 'text',
            text: '業務管理・会話検索のため、このグループの会話を記録します。\n\n記録を停止したい方は #記録停止 と送信してください。',
            size: 'xs',
            color: '#555555',
            wrap: true,
            margin: 'md',
          },
          { type: 'separator', margin: 'md' },
          {
            type: 'text',
            text: '#help で使い方をご確認ください',
            size: 'xs',
            color: '#86868b',
            margin: 'sm',
          },
        ],
        paddingAll: '16px',
      },
    },
  };
}

/**
 * Conversation review results — show search results as a bubble
 */
export function reviewResultsFlex(query, results) {
  const items = results.slice(0, 10).map(r => {
    const time = new Date(r.created_at).toLocaleString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    return {
      type: 'box',
      layout: 'vertical',
      spacing: 'xs',
      contents: [
        {
          type: 'text',
          text: `${time} ${r.display_name}`,
          size: 'xxs',
          color: '#86868b',
        },
        {
          type: 'text',
          text: (r.content || '').slice(0, 100),
          size: 'xs',
          wrap: true,
        },
      ],
      margin: 'md',
    };
  });

  if (items.length === 0) {
    items.push({
      type: 'text',
      text: '該当する会話が見つかりませんでした',
      size: 'sm',
      color: '#86868b',
      margin: 'md',
    });
  }

  return {
    type: 'flex',
    altText: `振り返り結果：${query}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '🔍 振り返り結果', weight: 'bold', size: 'sm' },
          { type: 'text', text: `「${query}」`, size: 'xs', color: '#86868b', margin: 'xs' },
        ],
        backgroundColor: '#f5f5f7',
        paddingAll: '14px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: items,
        paddingAll: '14px',
      },
    },
  };
}

// ─── Helpers ───

function sectionTitle(text) {
  return { type: 'text', text, weight: 'bold', size: 'sm', color: '#1d1d1f' };
}

function cmdRow(cmd, desc) {
  return {
    type: 'box',
    layout: 'horizontal',
    contents: [
      { type: 'text', text: cmd, size: 'xs', color: '#0066cc', flex: 3 },
      { type: 'text', text: desc, size: 'xs', color: '#555555', flex: 5, wrap: true },
    ],
    margin: 'sm',
  };
}

function separator() {
  return { type: 'separator', margin: 'md' };
}

// ─── Task Management Flex Messages ───

/**
 * Single task card — shown after creating a task
 */
export function taskCardFlex(task) {
  const dueText = task.due_date
    ? new Date(task.due_date).toLocaleString('ja-JP', {
        timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric',
        weekday: 'short', hour: '2-digit', minute: '2-digit',
      })
    : '期限なし';

  return {
    type: 'flex',
    altText: `✅ タスク登録：${task.title}`,
    contents: {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          { type: 'text', text: '✅ タスク登録完了', weight: 'bold', size: 'md', color: '#1d1d1f' },
          { type: 'separator' },
          { type: 'text', text: `📋 ${task.title}`, size: 'sm', wrap: true, margin: 'md' },
          { type: 'text', text: `📅 ${dueText}`, size: 'xs', color: '#555555', margin: 'sm' },
          { type: 'text', text: `👤 担当：${task.assigned_to_name || '未設定'}`, size: 'xs', color: '#555555', margin: 'sm' },
        ],
        paddingAll: '16px',
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'md',
        contents: [
          {
            type: 'button', style: 'primary', height: 'sm', color: '#06C755',
            action: { type: 'postback', label: '完了', data: `action=complete_task&id=${task.id}`, displayText: '#task 完了' },
          },
          {
            type: 'button', style: 'secondary', height: 'sm',
            action: { type: 'postback', label: '削除', data: `action=delete_task&id=${task.id}`, displayText: '#task 削除' },
          },
        ],
        paddingAll: '12px',
      },
    },
  };
}

/**
 * Task list — carousel of task cards
 */
export function taskListFlex(tasks, groupName) {
  if (tasks.length === 0) {
    return {
      type: 'flex',
      altText: 'タスク一覧：0件',
      contents: {
        type: 'bubble',
        size: 'kilo',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: '📋 タスク一覧', weight: 'bold', size: 'md' },
            { type: 'text', text: '未完了のタスクはありません ✨', size: 'sm', color: '#86868b', margin: 'md' },
          ],
          paddingAll: '16px',
        },
      },
    };
  }

  const bubbles = tasks.slice(0, 10).map(t => {
    const now = new Date();
    const due = t.due_date ? new Date(t.due_date) : null;
    const isOverdue = due && due < now;
    const dueText = due
      ? due.toLocaleString('ja-JP', {
          timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric',
          weekday: 'short', hour: '2-digit', minute: '2-digit',
        })
      : '期限なし';
    const statusIcon = isOverdue ? '🔴' : '⚪';

    return {
      type: 'bubble',
      size: 'kilo',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: `${statusIcon} ${t.title}`, weight: 'bold', size: 'sm', wrap: true },
          { type: 'text', text: `📅 ${dueText}`, size: 'xs', color: isOverdue ? '#FF3B30' : '#555555', margin: 'sm' },
          { type: 'text', text: `👤 ${t.assigned_to_name || '未設定'}`, size: 'xs', color: '#86868b', margin: 'xs' },
        ],
        paddingAll: '14px',
      },
      footer: {
        type: 'box',
        layout: 'horizontal',
        spacing: 'sm',
        contents: [
          {
            type: 'button', style: 'primary', height: 'sm', color: '#06C755',
            action: { type: 'postback', label: '完了', data: `action=complete_task&id=${t.id}`, displayText: '#task 完了' },
          },
          {
            type: 'button', style: 'secondary', height: 'sm',
            action: { type: 'postback', label: '削除', data: `action=delete_task&id=${t.id}`, displayText: '#task 削除' },
          },
        ],
        paddingAll: '10px',
      },
    };
  });

  return {
    type: 'flex',
    altText: `📋 タスク一覧（${tasks.length}件）`,
    contents: { type: 'carousel', contents: bubbles },
  };
}

/**
 * Reminder message — for Cron push notifications
 */
export function taskReminderFlex(tasks) {
  const items = tasks.slice(0, 5).map((t, i) => {
    const due = t.due_date ? new Date(t.due_date) : null;
    const now = new Date();
    const isOverdue = due && due < now;
    const dueText = due
      ? due.toLocaleString('ja-JP', {
          timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })
      : '';
    const label = isOverdue ? `🔴 ${t.title}` : `📋 ${t.title}`;

    return {
      type: 'box',
      layout: 'vertical',
      spacing: 'xs',
      margin: i > 0 ? 'md' : 'none',
      contents: [
        { type: 'text', text: label, size: 'sm', wrap: true, weight: 'bold' },
        { type: 'text', text: `${dueText}${dueText ? ' — ' : ''}${t.created_by_name || ''}`, size: 'xxs', color: isOverdue ? '#FF3B30' : '#86868b' },
      ],
    };
  });

  return {
    type: 'flex',
    altText: `⏰ 本日のタスク（${tasks.length}件）`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: '⏰ 本日のタスク', weight: 'bold', size: 'md' },
          { type: 'text', text: `${tasks.length}件のタスクがあります`, size: 'xs', color: '#86868b', margin: 'xs' },
        ],
        backgroundColor: '#FFF9E6',
        paddingAll: '14px',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: items,
        paddingAll: '14px',
      },
    },
  };
}
