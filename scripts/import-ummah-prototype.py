"""Convert the supplied static design into scoped view templates, not an iframe."""
from html.parser import HTMLParser
from html import escape
from pathlib import Path
import json,sys,re,hashlib,subprocess
class Node:
 def __init__(self,tag='',attrs=(),parent=None): self.tag=tag;self.attrs=dict(attrs);self.children=[];self.parent=parent
 def find(self,p):
  if p(self): return self
  for c in self.children:
   if isinstance(c,Node):
    r=c.find(p)
    if r:return r
 def walk(self):
  yield self
  for c in self.children:
   if isinstance(c,Node):yield from c.walk()
 def text(self):return ''.join(c.text() if isinstance(c,Node) else c for c in self.children)
 def render(self):
  if self.tag in ['script','iframe','object','embed']:return ''
  a={k:v for k,v in self.attrs.items() if not k.startswith('on')}
  if 'href' in a:
   h=a['href'];a['href']='#/'+h[1:] if h.startswith('#') else '#/directory'
  if self.tag=='input':a.setdefault('aria-label',a.get('placeholder','Input'))
  if self.tag=='button':a['type']='button'
  if 'preview-control' in a.get('class',''):
   a.pop('title',None);a['data-action']=self.text().strip()
   if self.tag=='div':a['role']='button';a['tabindex']='0'
  if a.get('contenteditable')=='false':a['contenteditable']='true';a['role']='textbox';a['aria-label']='Draft text';a['data-placeholder']=self.text()
  attrs=''.join(' '+k+('="'+escape(v,quote=True)+'"' if v is not None else '') for k,v in a.items())
  content=''.join(c.render() if isinstance(c,Node) else escape(c) for c in self.children)
  return '<'+self.tag+attrs+'>'+('' if self.tag in ['input','br','img','hr','meta','link'] else content+'</'+self.tag+'>')
class Parser(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.root=Node('root');self.cur=self.root
 def handle_starttag(self,t,a):
  n=Node(t,a,self.cur);self.cur.children.append(n)
  if t not in ['input','br','img','hr','meta','link']:self.cur=n
 def handle_startendtag(self,t,a):self.handle_starttag(t,a)
 def handle_endtag(self,t):
  n=self.cur
  while n.parent and n.tag!=t:n=n.parent
  if n.parent:self.cur=n.parent
 def handle_data(self,d):self.cur.children.append(d)
p=Path(sys.argv[1]);parser=Parser();parser.feed(p.read_text());root=parser.root
screens=[]
for n in root.walk():
 if n.tag=='section' and n.attrs.get('id','').startswith(('screen-','mosque-')):
  title=n.find(lambda v:v.tag=='h2').text()
  content=n.find(lambda v:'screen' in v.attrs.get('class','').split())
  screens.append({'id':n.attrs['id'],'title':title,'html':content.render()})
Path('src/ummah/screens.json').write_text(json.dumps(screens,ensure_ascii=False,indent=2))
css=root.find(lambda v:v.tag=='style').text()
Path('src/ummah/prototype.raw.css').write_text(css)
Path('docs/ummahconnect/source-reference.json').write_text(json.dumps({'filename':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'mainScreens':33,'mosqueTabs':5},indent=2))
print('Imported',len(screens),'views')

subprocess.run(["node","scripts/scope-prototype-css.mjs"],check=True)
