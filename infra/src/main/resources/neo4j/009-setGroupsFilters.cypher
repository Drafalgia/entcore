MATCH (g:ProfileGroup) SET g.filter = last(split(g.name, '-'));
MATCH (g:FunctionGroup) SET g.filter = g.name;
MATCH (g:FunctionGroup) WHERE g.name ENDS WITH '-AdminLocal' SET g.filter = 'AdminLocal';
