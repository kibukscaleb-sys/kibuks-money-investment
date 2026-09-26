/* HUT 10 PRO data layer
   Reads authenticated account data from Supabase public tables.
   RLS should restrict every table to the signed-in user's auth.uid().
*/
(function(){
  const cfg=window.HUT10_SUPABASE_CONFIG;
  const ready=()=>cfg && cfg.url && cfg.key && !cfg.url.includes('PASTE_YOUR_') && !cfg.key.includes('PASTE_YOUR_');
  window.HUT10Data={
    client:null,
    async init(){
      if(!ready()||!window.supabase)return null;
      this.client=window.supabase.createClient(cfg.url,cfg.key,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}});
      const {data,error}=await this.client.auth.getUser();
      if(error||!data.user)return null;
      this.user=data.user;
      return data.user;
    },
    async select(table,filterColumn='user_id'){
      if(!this.client||!cfg.tables?.[table])return [];
      const relation=cfg.tables[table];
      let q=this.client.from(relation).select('*').limit(100);
      if(this.user){
        const {data,error}=await q.eq(filterColumn,this.user.id);
        if(!error)return data||[];
      }
      return [];
    },
    async load(){
      if(!this.client)return {wallet:[],investments:[],transactions:[]};
      const [wallet,investments,transactions]=await Promise.all([
        this.select('wallets'),
        this.select('investments'),
        this.select('transactions')
      ]);
      return {wallet,investments,transactions};
    },
    sum(rows,keys){
      return (rows||[]).reduce((total,row)=>{
        for(const k of keys){ if(row[k]!==undefined && row[k]!==null && row[k]!=='') return total+Number(row[k])||total; }
        return total;
      },0);
    }
  };
})();