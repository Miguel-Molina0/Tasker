import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Title, Txt, useColors } from './ui';

export const BAIXADA_CITIES = ['Bertioga', 'Cubatão', 'Guarujá', 'Itanhaém', 'Mongaguá', 'Peruíbe', 'Praia Grande', 'Santos', 'São Vicente'];
export const WORK_AREAS = ['Beleza', 'Construção e reformas', 'Design', 'Educação', 'Elétrica', 'Eventos', 'Jardinagem', 'Limpeza', 'Manutenção', 'Tecnologia', 'Transporte', 'Outros'];
const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

export function OptionSelect({label,value,options,onChange,placeholder='Selecione uma opção'}:{label:string;value:string;options:string[];onChange:(value:string)=>void;placeholder?:string}) {
 const [open,setOpen]=useState(false),c=useColors();
 return <View style={{gap:7}}>
  <Txt style={{fontSize:12,fontWeight:'600'}}>{label}</Txt>
  <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={()=>setOpen(true)} style={{borderRadius:18,borderColor:c.controlLine,borderWidth:1,backgroundColor:c.panel,minHeight:52,paddingHorizontal:15,flexDirection:'row',alignItems:'center',gap:10}}>
   <Ionicons name="list-outline" size={20} color={c.accent}/><Txt style={{flex:1}}>{value||placeholder}</Txt><Ionicons name="chevron-down" size={18} color={c.muted}/>
  </Pressable>
  <Modal visible={open} transparent animationType="fade" onRequestClose={()=>setOpen(false)}><View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:24}}>
   <View style={{backgroundColor:c.card,borderRadius:20,padding:18,maxHeight:'75%',gap:12}}><Title>{label}</Title>
    <ScrollView keyboardShouldPersistTaps="handled">{options.map(item=><Pressable key={item} onPress={()=>{onChange(item);setOpen(false);}} style={{paddingVertical:14,borderBottomWidth:1,borderBottomColor:c.line,flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Txt>{item}</Txt>{item===value&&<Ionicons name="checkmark-circle" color={c.accent} size={20}/>}</Pressable>)}</ScrollView>
    <Pressable accessibilityRole="button" onPress={()=>setOpen(false)} style={{padding:12,alignItems:'center'}}><Txt style={{color:c.accent}}>Fechar</Txt></Pressable>
   </View>
  </View></Modal>
 </View>;
}
export function BirthDateSelect({value,onChange}:{value:string;onChange:(value:string)=>void}) {
 const [year='',month='',day='']=value.split('-');
 const now=new Date();
 const years=Array.from({length:now.getFullYear()-1899},(_,i)=>String(now.getFullYear()-i));
 const maxDay=year && month ? new Date(Number(year),Number(month),0).getDate() : 31;
 const days=Array.from({length:maxDay},(_,i)=>String(i+1).padStart(2,'0'));
 const set=(y:string,m:string,d:string)=>onChange(`${y}-${m}-${d}`);
 return <View style={{gap:9}}><Txt style={{fontSize:12,fontWeight:'600'}}>Data de nascimento</Txt><View style={{flexDirection:'row',gap:8}}>
  <View style={{flex:1}}><OptionSelect label="Dia" value={day} options={days} onChange={d=>set(year,month,d)}/></View>
  <View style={{flex:1.5}}><OptionSelect label="Mês" value={month?MONTHS[Number(month)-1]:''} options={MONTHS} onChange={m=>set(year,String(MONTHS.indexOf(m)+1).padStart(2,'0'),day)}/></View>
  <View style={{flex:1.3}}><OptionSelect label="Ano" value={year} options={years} onChange={y=>set(y,month,day)}/></View>
 </View></View>;
}
