const $ = id => document.getElementById(id);
let spacesPage = 1, postsPage = 1, selected = null, generation = 0;
const messages = {
  isolated_social_instance_required: 'Connect an isolated HumHub instance to begin.',
  social_not_configured: 'The test instance and a linked member account are not configured yet.',
  social_session_expired: 'The test account token has expired or was rejected.',
  social_access_denied: 'This account does not have permission to view this community.',
  social_identity_mismatch: 'The configured member ID does not match the connected account.',
  social_not_found: 'This community is unavailable to this account.',
  social_rate_limited: 'The social service is busy. Please retry shortly.',
};
async function api(path) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store' });
  const data = await response.json();
  if (!response.ok) throw new Error(messages[data.error] || 'The social service could not be reached. Check the test connection and retry.');
  return data;
}
function element(tag, text, className) {
  const node = document.createElement(tag); node.textContent = text;
  if (className) node.className = className;
  return node;
}
function notice(message) {
  $('connection-title').textContent = 'Connection needs attention';
  $('connection-detail').textContent = message;
  document.querySelector('.connection').classList.remove('ready');
}
function pagination(kind, data) {
  $(kind + '-prev').disabled = data.page <= 1;
  $(kind + '-next').disabled = data.page >= data.pages;
  $(kind + '-page').textContent = data.pages ? `${data.page} / ${data.pages}` : '';
}
function resetPages() { for (const name of ['spaces', 'posts']) pagination(name, { page: 1, pages: 0 }); }
async function loadPosts(space, page = 1) {
  const request = ++generation; selected = space; postsPage = page;
  $('posts').replaceChildren(element('p', 'Loading community posts…', 'muted'));
  pagination('posts', { page: 1, pages: 0 });
  for (const button of $('spaces').children) button.setAttribute('aria-pressed', String(button.dataset.id === String(space.id)));
  try {
    const data = await api(`/api/posts?space=${space.id}&page=${page}`);
    if (request !== generation) return;
    $('feed-title').textContent = data.space.name;
    $('feed-description').textContent = 'Posts visible to your connected test account. Displayed as plain text.';
    const nodes = data.items.map(post => {
      const article = element('article', '', 'post');
      article.append(element('small', `Community post · ${post.id}`), element('p', post.message));
      return article;
    });
    $('posts').replaceChildren(...(nodes.length ? nodes : [element('p', 'No posts visible in this community yet.', 'muted')]));
    pagination('posts', data);
  } catch (error) { if (request !== generation) return; $('posts').replaceChildren(element('p', error.message, 'muted')); notice(error.message); }
}
async function loadSpaces(page = 1) {
  const request = ++generation; selected = null; spacesPage = page;
  $('feed-title').textContent = 'Community reflections';
  $('feed-description').textContent = 'Choose a connected community to read its posts.';
  $('spaces').replaceChildren(); $('posts').replaceChildren(element('p', 'Choose a community to read its posts.', 'muted')); resetPages();
  try {
    const data = await api(`/api/spaces?page=${page}`);
    if (request !== generation) return;
    for (const space of data.items) {
      const button = element('button', space.name, 'space'); button.type = 'button'; button.dataset.id = space.id; button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => loadPosts(space)); $('spaces').append(button);
    }
    if (!data.items.length) $('spaces').append(element('p', 'No communities are visible to this account.', 'muted'));
    pagination('spaces', data);
  } catch (error) { if (request !== generation) return; notice(error.message); }
}
async function connect() {
  ++generation; selected = null; resetPages(); $('spaces').replaceChildren();
  $('retry').disabled = true;
  $('connection-title').textContent = 'Connecting…';
  $('posts').replaceChildren(element('p', 'Waiting for your community connection.', 'muted'));
  try {
    const user = await api('/api/me');
    $('connection-title').textContent = `Connected as ${user.name}`;
    $('connection-detail').textContent = 'Real HumHub data · Member permissions applied · Read-only';
    document.querySelector('.connection').classList.add('ready');
    await loadSpaces();
  } catch (error) { notice(error.message); }
  finally { $('retry').disabled = false; }
}
$('retry').addEventListener('click', connect);
$('spaces-prev').addEventListener('click', () => loadSpaces(spacesPage - 1));
$('spaces-next').addEventListener('click', () => loadSpaces(spacesPage + 1));
$('posts-prev').addEventListener('click', () => selected && loadPosts(selected, postsPage - 1));
$('posts-next').addEventListener('click', () => selected && loadPosts(selected, postsPage + 1));
connect();
